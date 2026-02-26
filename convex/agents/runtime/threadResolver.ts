import { listMessages } from "@convex-dev/agent";
import { api, components, internal } from "../../_generated/api";
import { WHATSAPP_THREAD_MAX_IDLE_MS, type AgentChannel } from "../actions/shared";

async function getThreadLastActivityAt(
  ctx: { runQuery: Function; runMutation: Function },
  threadId: string,
): Promise<number | undefined> {
  try {
    const latestMessagePage = await listMessages(ctx as any, components.agent, {
      threadId,
      paginationOpts: { cursor: null, numItems: 1 },
    });
    const latestMessage = latestMessagePage.page[0] as
      | { _creationTime?: number }
      | undefined;
    if (typeof latestMessage?._creationTime === "number") return latestMessage._creationTime;
  } catch (error) {
    console.warn("[thread] get latest message activity failed:", error);
  }
  try {
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId });
    if (thread && typeof (thread as { _creationTime?: number })._creationTime === "number") {
      return (thread as { _creationTime: number })._creationTime;
    }
  } catch (error) {
    console.warn("[thread] get thread fallback activity failed:", error);
  }
  return undefined;
}

async function persistWhatsAppRolloverSnapshot(
  ctx: { runMutation: Function },
  params: {
    userId: string;
    threadId: string;
    previousThreadId: string;
    previousLastActivityAt: number;
  },
): Promise<void> {
  try {
    await ctx.runMutation(internal.services.memory.storeInternal, {
      userId: params.userId,
      threadId: params.threadId,
      memoryType: "fact",
      key: "last_whatsapp_session_rollover",
      value: JSON.stringify({
        previousThreadId: params.previousThreadId,
        previousLastActivityAt: params.previousLastActivityAt,
        rolledOverAt: Date.now(),
        continuity:
          "Keep minimal user knowledge (preferences, constraints, last search summary) across threads.",
      }),
      confidence: 1,
      source: "system",
    });
  } catch (error) {
    console.warn("[thread] rollover snapshot failed:", error);
  }
}

export async function resolveReplyThread(
  ctx: { runQuery: Function; runMutation: Function },
  params: {
    userId: string;
    message: string;
    channel: AgentChannel;
  },
): Promise<{ threadId: string; rolledOver: boolean; previousThreadId?: string }> {
  const createFreshThread = async () => {
    const created = await ctx.runMutation(api.agents.actions.createThreadAction, {
      userId: params.userId,
      title: params.message.slice(0, 50),
      channel: params.channel,
    });
    return { threadId: created.threadId, rolledOver: false };
  };
  const latestByChannel = await ctx.runQuery(
    internal.agents.actions.getLatestThreadMetadataByUserChannel,
    { userId: params.userId, channel: params.channel },
  );
  let latestThreadId: string | undefined;
  let latestThreadCreatedAt: number | undefined;
  if (latestByChannel?.threadId) {
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: latestByChannel.threadId,
    });
    if (thread) {
      latestThreadId = thread._id;
      latestThreadCreatedAt = thread._creationTime;
    }
  }
  if (!latestThreadId) {
    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: params.userId,
      paginationOpts: { numItems: 1, cursor: null },
    });
    const latestThread = threads.page[0] as
      | { _id: string; _creationTime?: number }
      | undefined;
    if (!latestThread) return createFreshThread();
    latestThreadId = latestThread._id;
    latestThreadCreatedAt = latestThread._creationTime;
  }
  if (params.channel !== "whatsapp") {
    return { threadId: latestThreadId, rolledOver: false };
  }
  const lastActivityAt =
    latestByChannel?.lastActivityAt ??
    (await getThreadLastActivityAt(ctx, latestThreadId)) ??
    latestThreadCreatedAt ??
    Date.now();
  if (Date.now() - lastActivityAt <= WHATSAPP_THREAD_MAX_IDLE_MS) {
    return { threadId: latestThreadId, rolledOver: false };
  }
  const created = await ctx.runMutation(api.agents.actions.createThreadAction, {
    userId: params.userId,
    title: params.message.slice(0, 50),
    channel: params.channel,
  });
  await persistWhatsAppRolloverSnapshot(ctx, {
    userId: params.userId,
    threadId: created.threadId,
    previousThreadId: latestThreadId,
    previousLastActivityAt: lastActivityAt,
  });
  return {
    threadId: created.threadId,
    rolledOver: true,
    previousThreadId: latestThreadId,
  };
}
