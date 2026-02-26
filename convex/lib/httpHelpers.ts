/**
 * Pure HTTP helpers used by convex/http.ts.
 * Extracted for unit testing.
 */

import { ConvexError } from "convex/values";

export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getRateLimitMetadata(error: unknown): {
  message: string;
  retryAfterSeconds?: number;
} | null {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "object" && data && (data as { code?: string }).code === "RATE_LIMITED") {
      return {
        message:
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "Rate limit exceeded",
        retryAfterSeconds:
          typeof (data as { retryAfterSeconds?: unknown }).retryAfterSeconds === "number"
            ? (data as { retryAfterSeconds: number }).retryAfterSeconds
            : undefined,
      };
    }
  }

  const raw = String(error ?? "");
  if (!/RATE_LIMITED|Rate limit exceeded/i.test(raw)) return null;
  const retryAfterMatch =
    raw.match(/"retryAfterSeconds"\s*:\s*(\d+)/) ??
    raw.match(/"retryAfter"\s*:\s*(\d+)/);
  const messageMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
  return {
    message: messageMatch?.[1] ?? "Rate limit exceeded",
    retryAfterSeconds: retryAfterMatch?.[1]
      ? Number.parseInt(retryAfterMatch[1], 10)
      : undefined,
  };
}

export function maybeRateLimitedResponse(error: unknown): Response | null {
  const metadata = getRateLimitMetadata(error);
  if (!metadata) return null;
  return new Response(
    JSON.stringify({
      error: metadata.message,
      retryAfter: metadata.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...(metadata.retryAfterSeconds != null
          ? { "Retry-After": String(metadata.retryAfterSeconds) }
          : {}),
      },
    },
  );
}
