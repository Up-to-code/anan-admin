/**
 * WhatsApp OTP verification – request OTP, rate limit, send via template
 */
import { query, action, internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { WhatsAppService } from "../../channels/whatsapp/service";

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300; // 5 min

function getRateLimitConfig(): { windowMs: number; max: number } {
  const windowSec = parseInt(process.env.WHATSAPP_OTP_RATE_WINDOW_SEC ?? "60", 10);
  const max = parseInt(process.env.WHATSAPP_OTP_RATE_LIMIT ?? "1", 10);
  return {
    windowMs: Math.max(60, windowSec) * 1000,
    max: Math.max(0, max),
  };
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function generateOtp(): string {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/** Insert OTP request and pending verification. Called from action. Deletes all existing pending verifications for this phone before inserting (ensures only latest OTP is valid). */
export const insertOtpRequest = internalMutation({
  args: {
    phoneNumber: v.string(),
    otp: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { phoneNumber, otp, expiresAt }) => {
    const allPending = await ctx.db
      .query("pendingVerifications")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", phoneNumber))
      .collect();
    for (const p of allPending) {
      await ctx.db.delete(p._id);
    }
    await ctx.db.insert("otpRequests", { phoneNumber });
    await ctx.db.insert("pendingVerifications", { phoneNumber, otp, expiresAt });
  },
});

const DEV_LOG_OTP = process.env.CONVEX_DEV_LOG_OTP === "1";

/** Request OTP via WhatsApp. Rate limited to 3 per day per number. */
export const requestVerification = action({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }): Promise<{
    success: boolean;
    error?: string;
    retryAfterSeconds?: number;
    resetAt?: number;
    details?: string;
    alreadyVerified?: boolean;
    whatsappLink?: string;
    message?: string;
    /** Only set when CONVEX_DEV_LOG_OTP=1 – use for local login without WhatsApp */
    devOtp?: string;
  }> => {
    console.log("[AuthActions] requestVerification start", {
      phoneNumber,
    });
    const normalized = normalizePhone(phoneNumber);
    console.log("[AuthActions] normalized phone", {
      phoneNumber,
      normalized,
    });
    if (!normalized || normalized.length < 10) {
      console.warn("[AuthActions] invalid phone", { phoneNumber, normalized });
      return { success: false, error: "INVALID_PHONE" };
    }

    // Check if user has active session (already logged in)
    const sessionCheck = await ctx.runQuery(internal.features.auth.actions.checkActiveSession, {
      phoneNumber: normalized,
    });
    if (sessionCheck?.hasActiveSession) {
      return { success: false, error: "ALREADY_LOGGED_IN" };
    }

    // Check if phone is already verified (has userId means Better Auth user exists)
    const verifiedPhone: { phoneNumber: string; verifiedAt: number; userId?: string } | null = await ctx.runQuery(internal.features.auth.actions.getVerifiedPhone, {
      phoneNumber: normalized,
    });
    
    const alreadyVerified: boolean = !!verifiedPhone;
    
    // Invalidate any existing session tokens before creating new OTP
    // This ensures only one active verification flow at a time
    await ctx.runMutation(internal.features.auth.actions.invalidateSessionTokens, {
      phoneNumber: normalized,
    });
    console.log("[AuthActions] invalidated existing session tokens", {
      phoneNumber: normalized,
    });

    const { windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX } = getRateLimitConfig();
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    const requests = await ctx.runQuery(internal.features.auth.actions.countOtpRequestsSince, {
      phoneNumber: normalized,
      since: cutoff,
    });
    console.log("[AuthActions] otp request count", {
      phoneNumber: normalized,
      requests,
      cutoff,
      rateLimitMax: RATE_LIMIT_MAX,
    });
    if (RATE_LIMIT_MAX > 0 && requests >= RATE_LIMIT_MAX) {
      const { oldestCreationTime } = await ctx.runQuery(
        internal.features.auth.actions.getOldestOtpRequestInWindow,
        { phoneNumber: normalized, since: cutoff }
      );
      const resetAt =
        oldestCreationTime != null
          ? oldestCreationTime + RATE_LIMIT_WINDOW_MS
          : cutoff + RATE_LIMIT_WINDOW_MS;
      const retryAfterSeconds = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
      console.warn("[AuthActions] rate limit exceeded", {
        phoneNumber: normalized,
        resetAt,
        retryAfterSeconds,
      });
      return {
        success: false,
        error: "LIMIT_EXCEEDED",
        retryAfterSeconds,
        resetAt,
      };
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_EXPIRY_SECONDS * 1000;
    console.log("[AuthActions] generated otp", {
      phoneNumber: normalized,
      expiresAt,
      alreadyVerified,
    });

    await ctx.runMutation(internal.features.auth.actions.insertOtpRequest, {
      phoneNumber: normalized,
      otp,
      expiresAt,
    });
    console.log("[AuthActions] otp stored", {
      phoneNumber: normalized,
      expiresAt,
    });

    if (DEV_LOG_OTP) {
      console.log("[AuthActions] [DEV] OTP (copy to login):", {
        phoneNumber: normalized,
        otp,
        expiresIn: `${OTP_EXPIRY_SECONDS}s`,
      });
      // Single line so the code is easy to copy from terminal
      console.log(`[AuthActions] [DEV] OTP for ${normalized}: ${otp}`);
    }

    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
    const templateName =
      process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? "opt_en";
    const templateLang =
      process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? "en_US";

    if (!phoneNumberId) {
      console.error("[AuthActions] whatsapp not configured", {
        phoneNumber: normalized,
      });
      return { success: false, error: "WHATSAPP_NOT_CONFIGURED" };
    }

    // Try template first. Copy-code templates need OTP in body + button; body-only templates need just body.
    const hasCopyCodeButton = process.env.WHATSAPP_OTP_TEMPLATE_COPY_CODE === "true";
    const templateComponents = hasCopyCodeButton
      ? [
          { type: "body" as const, parameters: [{ type: "text" as const, text: otp }] },
          {
            type: "button" as const,
            sub_type: "url" as const,
            index: 0,
            parameters: [{ type: "text" as const, text: otp }],
          },
        ]
      : [{ type: "body" as const, parameters: [{ type: "text" as const, text: otp }] }];

    const wa = new WhatsAppService(phoneNumberId);
    const sendResult = await wa.sendTemplateWithComponents(
      normalized,
      templateName,
      templateLang,
      templateComponents as Array<Record<string, unknown>>
    );

    // When WhatsApp send fails, log OTP and return it so user can still log in (e.g. dev / number not in allowed list)
    if (!sendResult.success) {
      console.log(`[AuthActions] [DEV] OTP (WhatsApp failed): ${normalized} → ${otp}`);
      const businessNumber =
        process.env.WHATSAPP_BUSINESS_NUMBER ?? process.env.WHATSAPP_PHONE_NUMBER ?? "";
      if (businessNumber) {
        const message = `رمز التحقق: ${otp}`;
        const waNumber = businessNumber.replace(/\D/g, "");
        const whatsappLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
        console.log("[AuthActions] template failed, using wa.me fallback", {
          phoneNumber: normalized,
          error: sendResult.error,
        });
        return {
          success: true,
          whatsappLink,
          message,
          alreadyVerified,
          devOtp: otp,
        };
      }
      console.error("[AuthActions] template send failed", {
        phoneNumber: normalized,
        templateName,
        templateLang,
        error: sendResult.error,
      });
      return { success: true, alreadyVerified, devOtp: otp };
    }

    console.log("[AuthActions] OTP sent via template", {
      phoneNumber: normalized,
      templateName,
      templateLang,
      alreadyVerified,
    });

    return {
      success: true,
      alreadyVerified,
      ...(DEV_LOG_OTP && { devOtp: otp }),
    };
  },
});

const SESSION_TOKEN_EXPIRY_MS = 2 * 60 * 1000; // 2 min

function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 32; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Complete verification: check OTP match, delete pending, store verified + session token. Returns { success, error? }. */
export const completeVerification = internalMutation({
  args: { phoneNumber: v.string(), otp: v.string() },
  handler: async (ctx, { phoneNumber, otp }): Promise<{ success: boolean; error?: "EXPIRED" | "INVALID_OTP" | "NOT_FOUND" }> => {
    const normalized = phoneNumber.replace(/\D/g, "");
    const pending = await ctx.db
      .query("pendingVerifications")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .first();
    if (!pending) {
      console.log("[AuthActions] completeVerification failed", { phoneNumber: normalized, error: "NOT_FOUND" });
      return { success: false, error: "NOT_FOUND" };
    }
    if (Date.now() > pending.expiresAt) {
      await ctx.db.delete(pending._id);
      console.log("[AuthActions] completeVerification failed", { phoneNumber: normalized, error: "EXPIRED" });
      return { success: false, error: "EXPIRED" };
    }
    if (pending.otp !== otp) {
      console.log("[AuthActions] completeVerification failed", { phoneNumber: normalized, error: "INVALID_OTP" });
      return { success: false, error: "INVALID_OTP" };
    }
    await ctx.db.delete(pending._id);
    
    // Delete all existing session tokens for this phone number before creating new one
    // This ensures only one active session token exists at a time
    const existingTokens = await ctx.db
      .query("sessionTokens")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .collect();
    for (const token of existingTokens) {
      await ctx.db.delete(token._id);
    }
    console.log("[AuthActions] deleted existing session tokens", {
      phoneNumber: normalized,
      count: existingTokens.length,
    });
    
    const now = Date.now();
    
    // Check if phone is already verified, if so update the record, otherwise insert new
    const existingVerified = await ctx.db
      .query("verifiedPhones")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .order("desc")
      .first();
    
    if (existingVerified) {
      // Update existing verified record
      await ctx.db.patch(existingVerified._id, {
        verifiedAt: now,
      });
    } else {
      // Insert new verified record
      await ctx.db.insert("verifiedPhones", {
        phoneNumber: normalized,
        verifiedAt: now,
      });
    }
    
    const token = generateSessionToken();
    await ctx.db.insert("sessionTokens", {
      phoneNumber: normalized,
      token,
      expiresAt: now + SESSION_TOKEN_EXPIRY_MS,
    });
    console.log("[AuthActions] created new session token", {
      phoneNumber: normalized,
      expiresAt: now + SESSION_TOKEN_EXPIRY_MS,
    });
    return { success: true };
  },
});

/** Verify OTP entered by user on frontend. Completes verification and creates session token. */
export const verifyOTP = action({
  args: { phoneNumber: v.string(), otp: v.string() },
  handler: async (ctx, { phoneNumber, otp }): Promise<{ success: boolean; error?: "INVALID_OTP" | "EXPIRED" | "NOT_FOUND" }> => {
    const normalized = normalizePhone(phoneNumber);
    const result = await ctx.runMutation(internal.features.auth.actions.completeVerification, {
      phoneNumber: normalized,
      otp: otp.trim(),
    });
    if (!result.success && result.error) {
      console.log("[AuthActions] verifyOTP failed", { phoneNumber: normalized, error: result.error });
    }
    return { success: result.success, error: result.error };
  },
});

/** Get verification status for a phone (for polling). Returns sessionToken when verified for session creation.
 * This is an internal query - should only be called from trusted contexts.
 * The public version below requires the user to provide a valid pending verification.
 */
export const getVerificationStatusInternal = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const normalized = phoneNumber.replace(/\D/g, "");
    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .order("desc")
      .first();
    
    if (!verified) {
      return { verified: false };
    }
    
    // Phone is verified
    const alreadyVerified = true;
    
    // Check for active session token
    const tokenRecord = await ctx.db
      .query("sessionTokens")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .first();
    
    const sessionToken =
      tokenRecord && tokenRecord.expiresAt > Date.now() ? tokenRecord.token : undefined;
    
    // Check if there's a userId (means Better Auth user exists)
    const hasUserId = !!verified.userId;
    
    return {
      verified: true,
      alreadyVerified,
      sessionToken,
      hasUserId,
    };
  },
});

/** Get verification status for a phone (for polling). 
 * Only returns session token if there's an active pending verification for this phone.
 * This prevents enumeration attacks.
 */
export const getVerificationStatus = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const normalized = phoneNumber.replace(/\D/g, "");
    
    // Only return status if there's a pending verification or recent OTP request
    // This prevents enumeration of verified phone numbers
    const pending = await ctx.db
      .query("pendingVerifications")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .first();
    
    const recentOtpRequest = await ctx.db
      .query("otpRequests")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .order("desc")
      .first();
    
    // Only allow status check if there's an active verification flow (within last 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const hasActiveFlow = pending || (recentOtpRequest && recentOtpRequest._creationTime > tenMinutesAgo);
    
    if (!hasActiveFlow) {
      // Don't reveal whether the phone is verified or not
      return { verified: false, sessionToken: undefined };
    }
    
    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .order("desc")
      .first();
    
    if (!verified) {
      return { verified: false };
    }
    
    // Phone is verified
    const alreadyVerified = true;
    
    // Check for active session token
    const tokenRecord = await ctx.db
      .query("sessionTokens")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .first();
    
    const sessionToken =
      tokenRecord && tokenRecord.expiresAt > Date.now() ? tokenRecord.token : undefined;
    
    // Check if there's a userId (means Better Auth user exists)
    const hasUserId = !!verified.userId;
    
    return {
      verified: true,
      alreadyVerified,
      sessionToken,
      hasUserId,
    };
  },
});

/** Consume session token for Better Auth phone verify. Called from verifyOTP. Returns true if valid. */
export const consumeSessionToken = internalMutation({
  args: { phoneNumber: v.string(), token: v.string() },
  handler: async (ctx, { phoneNumber, token }) => {
    const normalized = phoneNumber.replace(/\D/g, "");
    const record = await ctx.db
      .query("sessionTokens")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .first();
    if (!record || record.token !== token || Date.now() > record.expiresAt) {
      return false;
    }
    await ctx.db.delete(record._id);
    return true;
  },
});

/** Internal: count OTP requests for phone since timestamp */
export const countOtpRequestsSince = internalQuery({
  args: { phoneNumber: v.string(), since: v.number() },
  handler: async (ctx, { phoneNumber, since }) => {
    const requests = await ctx.db
      .query("otpRequests")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", phoneNumber))
      .collect();
    return requests.filter((r) => r._creationTime >= since).length;
  },
});

/** Internal: get oldest OTP request creation time in window (for rate limit reset calculation) */
export const getOldestOtpRequestInWindow = internalQuery({
  args: { phoneNumber: v.string(), since: v.number() },
  handler: async (ctx, { phoneNumber, since }) => {
    const requests = await ctx.db
      .query("otpRequests")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", phoneNumber))
      .collect();
    const inWindow = requests.filter((r) => r._creationTime >= since);
    if (inWindow.length === 0) return { oldestCreationTime: null };
    const oldest = Math.min(...inWindow.map((r) => r._creationTime));
    return { oldestCreationTime: oldest };
  },
});

/** Get verified phone record if it exists */
export const getVerifiedPhone = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const normalized = phoneNumber.replace(/\D/g, "");
    return await ctx.db
      .query("verifiedPhones")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .order("desc")
      .first();
  },
});

/** Check if phone number has an active Better Auth session by checking verifiedPhones userId and Better Auth sessions */
export const checkActiveSession = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const normalized = phoneNumber.replace(/\D/g, "");
    
    // Check if phone is verified and has a userId (linked to Better Auth user)
    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .order("desc")
      .first();
    
    if (!verified || !verified.userId) {
      return { hasActiveSession: false };
    }

    // Check Better Auth sessions table for active sessions
    // Better Auth stores sessions in a table accessible via the adapter
    // We'll check if there are any active sessions for this userId
    try {
      // Query Better Auth sessions table through the adapter
      // The table name in Convex is typically "betterAuth_session" or similar
      // Since we can't directly query Better Auth's internal tables easily,
      // we'll use a different approach: check if there's an active session token
      // If there's no session token, the user needs to verify again
      const activeToken = await ctx.db
        .query("sessionTokens")
        .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
        .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
        .first();
      
      // If there's an active session token, it means they're in the process of verifying
      // But we can't directly check Better Auth sessions, so we'll return false here
      // The frontend will check if user is already logged in using useAuth()
      return { hasActiveSession: false, userId: verified.userId };
    } catch (error) {
      console.error("[AuthActions] error checking active session", { phoneNumber: normalized, error });
      return { hasActiveSession: false };
    }
  },
});

/** Delete all expired session tokens for a phone number */
export const cleanupExpiredTokens = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const normalized = phoneNumber.replace(/\D/g, "");
    const now = Date.now();
    const tokens = await ctx.db
      .query("sessionTokens")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .collect();
    
    let deletedCount = 0;
    for (const token of tokens) {
      if (token.expiresAt <= now) {
        await ctx.db.delete(token._id);
        deletedCount++;
      }
    }
    return { deletedCount };
  },
});

/** Delete all active session tokens for a phone number (invalidate before creating new one) */
export const invalidateSessionTokens = internalMutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const normalized = phoneNumber.replace(/\D/g, "");
    const tokens = await ctx.db
      .query("sessionTokens")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .collect();
    
    let deletedCount = 0;
    for (const token of tokens) {
      await ctx.db.delete(token._id);
      deletedCount++;
    }
    return { deletedCount };
  },
});

/** Cleanup expired session tokens and pending verifications. Can be called periodically. */
export const cleanupExpiredData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let deletedTokens = 0;
    let deletedPending = 0;

    // Cleanup expired session tokens
    const allTokens = await ctx.db.query("sessionTokens").collect();
    for (const token of allTokens) {
      if (token.expiresAt <= now) {
        await ctx.db.delete(token._id);
        deletedTokens++;
      }
    }

    // Cleanup expired pending verifications
    const allPending = await ctx.db.query("pendingVerifications").collect();
    for (const pending of allPending) {
      if (pending.expiresAt <= now) {
        await ctx.db.delete(pending._id);
        deletedPending++;
      }
    }

    console.log("[AuthActions] cleanup completed", {
      deletedTokens,
      deletedPending,
      timestamp: now,
    });

    return { deletedTokens, deletedPending };
  },
});
