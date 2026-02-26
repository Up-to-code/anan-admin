import { saveMessage } from "@convex-dev/agent";
import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { authComponent } from "../../auth";
import { enforceChatSendRateLimit } from "../../lib/rateLimiter";
import { components, internal } from "../../_generated/api";
import { debugLog } from "../debug";
import { CHANNEL_VALIDATOR } from "./shared";
import { persistInferredMemoryFacts } from "../runtime/memoryPersistence";
import { logMessageSentActivity } from "../runtime/activityLogger";

export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    body: v.string(),
    userId: v.optional(v.string()),
    channel: v.optional(CHANNEL_VALIDATOR),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, body, userId: clientUserId, channel }) => {
    debugLog("actions.sendMessage", "start", { threadId, channel, bodyLength: body.length });
    let authUserId: string | undefined;
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      authUserId = authUser?.userId ?? (authUser?._id ? String(authUser._id) : undefined);
    } catch {
      authUserId = undefined;
    }
    const callerUserId = authUserId ?? (clientUserId?.startsWith("anon-") ? clientUserId : undefined);
    if (!callerUserId) throw new Error("Authentication required");
    const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId });
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== callerUserId) throw new Error("Access denied: thread ownership mismatch");
    await enforceChatSendRateLimit(ctx, { userId: callerUserId, threadId });
    const { messageId } = await saveMessage(ctx, components.agent, { threadId, prompt: body });
    debugLog("actions.sendMessage", "saved_message", { threadId, messageId });
    await ctx.scheduler.runAfter(0, internal.agents.workflows.startGenerateResponseWorkflow, {
      threadId,
      promptMessageId: messageId,
      channel,
    });
    await persistInferredMemoryFacts(ctx, {
      userId: thread?.userId ?? undefined,
      threadId,
      message: body,
    });
    await ctx.runMutation(internal.agents.actions.touchThreadMetadata, {
      threadId,
      userId: thread?.userId ?? undefined,
      channel,
    });
    await logMessageSentActivity(ctx, {
      userId: thread?.userId ?? undefined,
      channel,
      threadId,
    });
    debugLog("actions.sendMessage", "done", {
      threadId,
      scheduled: true,
      hasUserId: Boolean(thread?.userId),
    });
    return null;
  },
});
