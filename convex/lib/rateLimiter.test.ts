import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { enforceChatSendRateLimit, enforceHttpRateLimit } from "./rateLimiter";

const dummyCtx = {
  runMutation: vi.fn(),
  runQuery: vi.fn(),
} as any;

describe("enforceChatSendRateLimit", () => {
  it("checks per-user then global for authenticated users", async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    await enforceChatSendRateLimit(
      dummyCtx,
      { userId: "u-1", threadId: "t-1" },
      { limit } as any,
    );
    expect(limit).toHaveBeenCalledTimes(2);
    expect(limit).toHaveBeenNthCalledWith(1, dummyCtx, "chatSendPerUser", {
      key: "u-1",
    });
    expect(limit).toHaveBeenNthCalledWith(2, dummyCtx, "chatSendGlobal");
  });

  it("checks per-thread then global for anonymous users", async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    await enforceChatSendRateLimit(
      dummyCtx,
      { threadId: "thread-anon" },
      { limit } as any,
    );
    expect(limit).toHaveBeenCalledTimes(2);
    expect(limit).toHaveBeenNthCalledWith(1, dummyCtx, "chatSendPerThread", {
      key: "thread-anon",
    });
    expect(limit).toHaveBeenNthCalledWith(2, dummyCtx, "chatSendGlobal");
  });

  it("throws RATE_LIMITED with retry metadata when global limit is exceeded", async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, retryAfter: 1500 });
    let thrown: unknown;
    try {
      await enforceChatSendRateLimit(
        dummyCtx,
        { userId: "u-1", threadId: "t-1" },
        { limit } as any,
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConvexError);
    const data = (thrown as ConvexError<any>).data as Record<string, unknown>;
    expect(data.code).toBe("RATE_LIMITED");
    expect(data.scope).toBe("global");
    expect(data.limitName).toBe("chatSendGlobal");
    expect(data.retryAfterMs).toBe(1500);
    expect(data.retryAfterSeconds).toBe(2);
  });
});

describe("enforceHttpRateLimit", () => {
  it("checks key-based HTTP limiter for ingress", async () => {
    const limit = vi.fn().mockResolvedValueOnce({ ok: true });
    await enforceHttpRateLimit(
      dummyCtx,
      { limitName: "httpChatIngressPerIp", key: "chat:1.2.3.4" },
      { limit } as any,
    );
    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenNthCalledWith(1, dummyCtx, "httpChatIngressPerIp", {
      key: "chat:1.2.3.4",
    });
  });

  it("throws RATE_LIMITED for HTTP key limits", async () => {
    const limit = vi.fn().mockResolvedValueOnce({ ok: false, retryAfter: 2000 });
    let thrown: unknown;
    try {
      await enforceHttpRateLimit(
        dummyCtx,
        { limitName: "httpTestColumnPerIp", key: "test-column:ip" },
        { limit } as any,
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConvexError);
    const data = (thrown as ConvexError<any>).data as Record<string, unknown>;
    expect(data.code).toBe("RATE_LIMITED");
    expect(data.scope).toBe("ip");
    expect(data.limitName).toBe("httpTestColumnPerIp");
    expect(data.retryAfterMs).toBe(2000);
    expect(data.retryAfterSeconds).toBe(2);
  });
});
