/**
 * Shared authentication utilities for Convex functions.
 * Centralizes auth logic to ensure consistent patterns across the codebase.
 */
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { ROLE_ADMIN } from "../roles";

type AnyCtx = QueryCtx | MutationCtx;

/**
 * Get the authenticated user's ID.
 * Returns the Better Auth userId if available, otherwise falls back to the document _id.
 * Throws if not authenticated.
 */
export async function requireAuth(ctx: AnyCtx): Promise<string> {
  const authUser = await authComponent.getAuthUser(ctx);
  if (!authUser) {
    throw new ConvexError({ code: "AUTH_ERROR", message: "Authentication required" });
  }
  const userId = authUser.userId ?? String(authUser._id);
  if (!userId) {
    throw new ConvexError({ code: "AUTH_ERROR", message: "Invalid user session" });
  }
  return userId;
}

/**
 * Get the authenticated user's ID if available, otherwise return null.
 * Does not throw for unauthenticated users.
 */
export async function optionalAuth(ctx: AnyCtx): Promise<string | null> {
  try {
    return await requireAuth(ctx);
  } catch {
    return null;
  }
}

/**
 * Get the authenticated user's ID for use with authComponent (Better Auth).
 * Throws if not authenticated. Use optionalAuth for non-throwing version.
 */
export async function getAuthUserId(ctx: AnyCtx): Promise<string> {
  return requireAuth(ctx);
}

/**
 * Get the authenticated user's ID if available, or null.
 * Use for contexts where auth is optional (e.g. favorites list).
 */
export async function getAuthUserIdOptional(ctx: AnyCtx): Promise<string | null> {
  return optionalAuth(ctx);
}

/**
 * Get the authenticated user's ID from an action context.
 * Actions have a different context type that doesn't support getAuthUser directly.
 */
export async function getAuthUserIdFromAction(
  ctx: ActionCtx,
  runQuery: <T>(query: any, args: any) => Promise<T>
): Promise<string | null> {
  // Actions need to call a query to get auth info
  // This is a placeholder - actual implementation depends on your auth setup
  return null;
}

/** WhatsApp temp-email pattern: digits@whatsapp.local */
const WHATSAPP_EMAIL_REGEX = /^(\d+)@whatsapp\.local$/;

/**
 * Get the authenticated user's phone number.
 * Checks verifiedPhones table first, then falls back to WhatsApp email pattern.
 */
export async function getAuthUserPhone(ctx: AnyCtx): Promise<string | null> {
  const userId = await optionalAuth(ctx);
  if (!userId) return null;

  // Check verifiedPhones table
  const verified = await ctx.db
    .query("verifiedPhones")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .first();
  if (verified) {
    return verified.phoneNumber.replace(/\D/g, "");
  }

  // Fall back to WhatsApp email pattern
  const authUser = await authComponent.getAuthUser(ctx);
  const email = (authUser as { email?: string })?.email;
  if (email) {
    const match = email.match(WHATSAPP_EMAIL_REGEX);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get the role for a phone number.
 * Returns "user" if no role is set.
 */
export async function getUserRoleByPhone(
  ctx: AnyCtx,
  phoneNumber: string
): Promise<"user" | "admin"> {
  const normalized = phoneNumber.replace(/\D/g, "");
  const row = await ctx.db
    .query("userRoles")
    .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
    .first();
  return row?.role ?? "user";
}

/**
 * Get role by userId from userProfiles.
 * Returns "user" if profile/role is missing.
 */
export async function getUserRoleByUserId(
  ctx: AnyCtx,
  userId: string
): Promise<"user" | "admin"> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .first();
  return profile?.role ?? "user";
}

/**
 * Require admin access. Throws if the current user is not an admin.
 * Checks both the new userRoles table (by phone) and legacy adminUsers table.
 */
export async function requireAdmin(ctx: AnyCtx): Promise<string> {
  const userId = await requireAuth(ctx);

  // Prefer userId-based role for admin app users (works even when no verified phone exists).
  const profileRole = await getUserRoleByUserId(ctx, userId);
  if (profileRole === ROLE_ADMIN) return userId;

  const phone = await getAuthUserPhone(ctx);

  // Check new role-based system
  if (phone) {
    const role = await getUserRoleByPhone(ctx, phone);
    if (role === ROLE_ADMIN) return userId;
  }

  // Check legacy adminUsers table
  const legacyAdmin = await ctx.db
    .query("adminUsers")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .first();
  if (legacyAdmin) return userId;

  throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" });
}

/**
 * Check if the current user is an admin without throwing.
 * Returns true if admin, false otherwise.
 */
export async function isAdmin(ctx: AnyCtx): Promise<boolean> {
  try {
    await requireAdmin(ctx);
    return true;
  } catch {
    return false;
  }
}
