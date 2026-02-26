import { internal } from "../../_generated/api";
import type { AgentChannel } from "../actions/shared";

export async function logMessageSentActivity(
  ctx: { runMutation: Function },
  params: {
    userId?: string;
    channel?: AgentChannel;
    threadId: string;
  },
): Promise<void> {
  if (!params.userId) return;
  try {
    await ctx.runMutation(internal.services.users.logActivityInternal, {
      userId: params.userId,
      action: "message_sent",
      channel: params.channel,
      metadata: { threadId: params.threadId },
    });
  } catch (error) {
    console.error("logMessageSentActivity error:", error);
  }
}
