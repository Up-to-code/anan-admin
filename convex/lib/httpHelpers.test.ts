import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
  getClientIp,
  getRateLimitMetadata,
  hashApiKey,
  isTruthyEnv,
  maybeRateLimitedResponse,
} from "./httpHelpers";

describe("hashApiKey", () => {
  it("returns hex digest for non-empty string", async () => {
    const hash = await hashApiKey("my-secret-key");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it("returns same hash for same input", async () => {
    const a = await hashApiKey("key");
    const b = await hashApiKey("key");
    expect(a).toBe(b);
  });

  it("returns different hashes for different inputs", async () => {
    const a = await hashApiKey("key1");
    const b = await hashApiKey("key2");
    expect(a).not.toBe(b);
  });

  it("handles empty string", async () => {
    const hash = await hashApiKey("");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles unicode", async () => {
    const hash = await hashApiKey("كلمة_سر");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("getClientIp", () => {
  it("extracts first IP from x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });

  it("trims whitespace around IP", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "  203.0.113.50  , 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("returns single IP when no comma", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "2001:db8::1" },
    });
    expect(getClientIp(req)).toBe("2001:db8::1");
  });

  it("returns 'unknown' when header absent", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("returns 'unknown' when header empty", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "" },
    });
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("isTruthyEnv", () => {
  it("returns true for 'true'", () => {
    expect(isTruthyEnv("true")).toBe(true);
    expect(isTruthyEnv("TRUE")).toBe(true);
    expect(isTruthyEnv("  true  ")).toBe(true);
  });

  it("returns true for '1'", () => {
    expect(isTruthyEnv("1")).toBe(true);
  });

  it("returns true for 'yes'", () => {
    expect(isTruthyEnv("yes")).toBe(true);
    expect(isTruthyEnv("YES")).toBe(true);
  });

  it("returns true for 'on'", () => {
    expect(isTruthyEnv("on")).toBe(true);
    expect(isTruthyEnv("ON")).toBe(true);
  });

  it("returns false for undefined", () => {
    expect(isTruthyEnv(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isTruthyEnv("")).toBe(false);
  });

  it("returns false for falsy values", () => {
    expect(isTruthyEnv("false")).toBe(false);
    expect(isTruthyEnv("0")).toBe(false);
    expect(isTruthyEnv("no")).toBe(false);
    expect(isTruthyEnv("off")).toBe(false);
  });
});

describe("getRateLimitMetadata", () => {
  it("extracts from ConvexError with RATE_LIMITED code", () => {
    const err = new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many requests",
      retryAfterSeconds: 60,
    });
    const meta = getRateLimitMetadata(err);
    expect(meta).toEqual({
      message: "Too many requests",
      retryAfterSeconds: 60,
    });
  });

  it("uses default message when ConvexError has no message", () => {
    const err = new ConvexError({ code: "RATE_LIMITED" });
    const meta = getRateLimitMetadata(err);
    expect(meta?.message).toBe("Rate limit exceeded");
  });

  it("returns null for ConvexError without RATE_LIMITED", () => {
    const err = new ConvexError({ code: "OTHER_ERROR" });
    expect(getRateLimitMetadata(err)).toBe(null);
  });

  it("parses retryAfterSeconds from raw error string", () => {
    const err = new Error('RATE_LIMITED {"message":"Rate limit","retryAfterSeconds":30}');
    const meta = getRateLimitMetadata(err);
    expect(meta).toEqual({ message: "Rate limit", retryAfterSeconds: 30 });
  });

  it("parses retryAfter from raw error string", () => {
    const err = new Error('Rate limit exceeded {"message":"Limit","retryAfter":45}');
    const meta = getRateLimitMetadata(err);
    expect(meta).toEqual({ message: "Limit", retryAfterSeconds: 45 });
  });

  it("returns null for unrelated errors", () => {
    expect(getRateLimitMetadata(new Error("Network failure"))).toBe(null);
    expect(getRateLimitMetadata(null)).toBe(null);
  });
});

describe("maybeRateLimitedResponse", () => {
  it("returns 429 Response when metadata present", async () => {
    const err = new ConvexError({
      code: "RATE_LIMITED",
      message: "Slow down",
      retryAfterSeconds: 10,
    });
    const res = maybeRateLimitedResponse(err);
    expect(res).not.toBe(null);
    expect(res?.status).toBe(429);
    const body = await res!.json();
    expect(body).toEqual({ error: "Slow down", retryAfter: 10 });
    expect(res?.headers.get("Retry-After")).toBe("10");
  });

  it("returns null when metadata is null", () => {
    expect(maybeRateLimitedResponse(new Error("Other"))).toBe(null);
  });

  it("omits Retry-After when retryAfterSeconds undefined", () => {
    const err = new ConvexError({ code: "RATE_LIMITED", message: "Limit" });
    const res = maybeRateLimitedResponse(err);
    expect(res?.headers.has("Retry-After")).toBe(false);
  });
});
