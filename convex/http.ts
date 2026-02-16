import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import {
  handleWhatsAppWebhookGet,
  handleWhatsAppWebhookPost,
} from "./channels/whatsapp/webhook";
import { detectChannel } from "./channels/types";

const http = httpRouter();

// Simple in-memory rate limiting for HTTP endpoints
// Note: This resets on deployment. For production, consider using a distributed rate limiter.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  // Clean up expired entry
  if (entry && now > entry.resetAt) {
    rateLimitMap.delete(key);
  }
  
  const currentEntry = rateLimitMap.get(key);
  if (!currentEntry) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  if (currentEntry.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((currentEntry.resetAt - now) / 1000) };
  }
  
  currentEntry.count++;
  return { allowed: true };
}

// Note: Rate limit entries are cleaned up lazily when checked.
// For production, consider using Convex's built-in rate limiting or a scheduled function.

/** Better Auth routes - must be registered first */
authComponent.registerRoutes(http, createAuth, { cors: true });

/** Partner API: add property. Authenticate via Authorization: Bearer <partner_api_key> */
http.route({
  path: "/api/partner/properties",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const apiKey = authHeader.slice(7).trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing API key" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const hash = await hashApiKey(apiKey);
    const partnerId = await ctx.runQuery(
      internal.services.partners.getPartnerByApiKeyHash,
      { apiKeyHash: hash }
    );
    if (!partnerId) {
      return new Response(
        JSON.stringify({ error: "Invalid API key or partner inactive" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const title = String(body.title ?? "");
    const address = String(body.address ?? "");
    const price = Number(body.price ?? 0);
    const beds = Number(body.beds ?? 0);
    const baths = Number(body.baths ?? 0);
    const description = String(body.description ?? "");

    if (!title || !address || !description || price <= 0 || beds <= 0 || baths <= 0) {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid fields: title, address, description, price, beds, baths required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const id = await ctx.runMutation(api.services.partners.addProperty, {
        partnerId,
        title,
        address,
        price,
        beds,
        baths,
        sqft: body.sqft != null ? Number(body.sqft) : undefined,
        description,
        body: body.body,
      });
      return new Response(
        JSON.stringify({ id, status: "created" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e) }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generic chat API: POST body { threadId?, message, userId? }
 * Rate limited to prevent abuse.
 */
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Rate limit by IP or user ID
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `chat:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 30, 60000); // 30 requests per minute
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded", 
          retryAfter: rateLimit.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter)
          } 
        }
      );
    }
    
    const body = await request.json().catch(() => ({}));
    const { threadId, message, userId: providedUserId } = body as {
      threadId?: string;
      message?: string;
      userId?: string;
    };
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Validate message length
    if (message.length > 10000) {
      return new Response(JSON.stringify({ error: "message too long (max 10000 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    try {
      // Get authenticated user if available
      const auth = createAuth(ctx);
      let authUser: { id: string } | null = null;
      try {
        const session = await auth.api.getSession({ headers: request.headers });
        authUser = session?.user ? { id: session.user.id } : null;
      } catch {
        // Auth not available or invalid, continue with anonymous
      }

      let tid = threadId;
      if (!tid) {
        // For authenticated users, userId comes from auth (providedUserId ignored)
        // For anonymous users, use providedUserId or let createThreadAction generate unique ID
        const { threadId: newId } = await ctx.runMutation(
          api.agents.actions.createThreadAction,
          { userId: authUser ? undefined : providedUserId }
        );
        tid = newId;
      }
      await ctx.runMutation(api.agents.actions.sendMessage, {
        threadId: tid,
        body: message,
        channel: detectChannel({ type: "api_chat", headers: request.headers }),
      });
      return new Response(
        JSON.stringify({ threadId: tid, status: "sent" }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Test helper API: returns generated reply payload synchronously.
 * Useful for curl-based QA in local/dev environments.
 */
http.route({
  path: "/api/test/agent-reply",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `test-agent-reply:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 30, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter),
          },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { message, userId, channel } = body as {
      message?: string;
      userId?: string;
      channel?: "whatsapp" | "app" | "web";
    };

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (message.length > 10000) {
      return new Response(JSON.stringify({ error: "message too long (max 10000 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const reply = await ctx.runAction(internal.agents.actions.generateReplyAndReturnText, {
        userId: userId ?? `test-${crypto.randomUUID()}`,
        message,
        channel: channel ?? detectChannel({ type: "api_chat", headers: request.headers }),
      });

      return new Response(JSON.stringify(reply), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/** Column test runner: POST body { userId?, channel? }. Runs all column tests, judges, returns Pass/Fail and improvement suggestions. */
http.route({
  path: "/api/test/column",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `test-column:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 120000); // 5 runs per 2 min
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", retryAfter: rateLimit.retryAfter }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userId, channel } = body as { userId?: string; channel?: "whatsapp" | "app" | "web" };

    try {
      const report = await ctx.runAction(internal.agents.actions.runAllColumnTests, {
        userId: userId ?? `test-column-${crypto.randomUUID()}`,
        channel: channel ?? "app",
      });

      return new Response(JSON.stringify(report), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/** WhatsApp webhook - verification (GET) and incoming messages (POST). Delegates to channels/whatsapp/webhook. */
http.route({
  path: "/api/webhook/whatsapp",
  method: "GET",
  handler: httpAction(async (ctx, request) =>
    handleWhatsAppWebhookGet(ctx as Parameters<typeof handleWhatsAppWebhookGet>[0], request)
  ),
});

http.route({
  path: "/api/webhook/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    handleWhatsAppWebhookPost(ctx as Parameters<typeof handleWhatsAppWebhookPost>[0], request)
  ),
});

export default http;
