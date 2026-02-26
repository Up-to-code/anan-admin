import {
  createThread,
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { mutation, internalMutation, internalQuery, query } from "../../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { authComponent } from "../../auth";
import { optionalAuth, requireAdmin } from "../../lib/auth";
import { components, internal } from "../../_generated/api";
import { CHANNEL_VALIDATOR, THREAD_TTL_MS } from "./shared";

export const getLatestThreadMetadataByUserChannel = internalQuery({
  args: { userId: v.string(), channel: CHANNEL_VALIDATOR },
  returns: v.union(
    v.null(),
    v.object({ threadId: v.string(), lastActivityAt: v.number() }),
  ),
  handler: async (ctx, { userId, channel }) => {
    const rows = await ctx.db
      .query("threadMetadata")
      .withIndex("userId_channel_lastActivityAt", (q) =>
        q.eq("userId", userId).eq("channel", channel),
      )
      .order("desc")
      .take(1);
    const latest = rows[0];
    if (!latest) return null;
    return { threadId: latest.threadId, lastActivityAt: latest.lastActivityAt };
  },
});

export const touchThreadMetadata = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.optional(v.string()),
    channel: v.optional(CHANNEL_VALIDATOR),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, userId, channel }) => {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId });
      resolvedUserId = thread?.userId ?? undefined;
    }
    if (!resolvedUserId) return null;
    const now = Date.now();
    const expiresAt = now + THREAD_TTL_MS;
    const existing = await ctx.db
      .query("threadMetadata")
      .withIndex("threadId", (q) => q.eq("threadId", threadId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: resolvedUserId,
        ...(channel ? { channel } : {}),
        lastActivityAt: now,
        expiresAt,
      });
      return null;
    }
    await ctx.db.insert("threadMetadata", {
      threadId,
      userId: resolvedUserId,
      channel,
      lastActivityAt: now,
      expiresAt,
    });
    return null;
  },
});

export const archiveExpiredThreads = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ archivedCount: v.number() }),
  handler: async (ctx, { limit = 100 }) => {
    const now = Date.now();
    const candidates = await ctx.db
      .query("threadMetadata")
      .withIndex("expiresAt", (q) => q.lte("expiresAt", now))
      .take(limit * 2)
      .then((rows) => rows.filter((item) => !item.archivedAt).slice(0, limit));
    let archivedCount = 0;
    for (const item of candidates) {
      try {
        await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
          threadId: item.threadId,
        });
      } catch (error) {
        console.error("archiveExpiredThreads delete thread error:", error);
      }
      await ctx.db.patch(item._id, { archivedAt: now });
      archivedCount += 1;
    }
    return { archivedCount };
  },
});

export const createThreadAction = mutation({
  args: {
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    channel: v.optional(CHANNEL_VALIDATOR),
  },
  handler: async (ctx, { userId: providedUserId, title, channel }) => {
    let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
    try {
      authUser = await authComponent.getAuthUser(ctx);
    } catch {
      authUser = null;
    }
    let userId: string;
    if (authUser) {
      const authUserId = authUser.userId && authUser.userId !== null ? authUser.userId : String(authUser._id);
      userId = authUserId;
      if (providedUserId && providedUserId !== authUserId) {
        throw new Error("User ID mismatch: provided userId does not match authenticated user");
      }
    } else {
      userId = providedUserId ?? `anon-${crypto.randomUUID()}`;
    }
    const threadId = await createThread(ctx, components.agent, { userId, title });
    await ctx.runMutation(internal.agents.actions.touchThreadMetadata, { threadId, userId, channel });
    return { threadId };
  },
});

export const getThreadMessages = query({
  args: {
    threadId: v.string(),
    userId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
    allowAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId: args.threadId });
    if (!thread) throw new Error("Thread not found");
    let currentUserId: string | null = null;
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      currentUserId = authUser?.userId ?? (authUser?._id ? String(authUser._id) : null);
    } catch {
      currentUserId = null;
    }
    if (args.allowAdmin) {
      await requireAdmin(ctx);
    } else {
      const callerUserId = currentUserId ?? (args.userId?.startsWith("anon-") ? args.userId : null);
      if (!callerUserId) throw new Error("Authentication required");
      if (!thread.userId || thread.userId !== callerUserId) {
        throw new Error("Access denied: you can only view your own threads");
      }
    }
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });
    return { ...paginated, streams };
  },
});

export const listThreads = query({
  args: { userId: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { userId: clientUserId, paginationOpts }) => {
    const authUserId = await optionalAuth(ctx);
    const userId = authUserId ?? (clientUserId?.startsWith("anon-") ? clientUserId : undefined);
    return ctx.runQuery(components.agent.threads.listThreadsByUserId, { userId, paginationOpts });
  },
});

export const searchThreads = query({
  args: { userId: v.optional(v.string()), query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId: clientUserId, query: searchQuery, limit = 50 }) => {
    const authUserId = await optionalAuth(ctx);
    const userId = authUserId ?? (clientUserId?.startsWith("anon-") ? clientUserId : undefined);
    return ctx.runQuery(components.agent.threads.searchThreadTitles, {
      userId,
      query: searchQuery,
      limit,
    });
  },
});

export const deleteThread = mutation({
  args: { threadId: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, { threadId, userId: clientUserId }) => {
    let resolvedUserId: string | undefined;
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      resolvedUserId = authUser.userId && authUser.userId !== null ? authUser.userId : String(authUser._id);
    } catch {
      resolvedUserId = clientUserId?.startsWith("anon-") ? clientUserId : undefined;
    }
    if (!resolvedUserId) throw new Error("Authentication required");
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId });
    if (!thread || thread.userId !== resolvedUserId) {
      throw new Error("Thread not found or access denied");
    }
    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, { threadId });
    return { success: true };
  },
});
