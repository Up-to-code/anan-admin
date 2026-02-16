/**
 * Durable workflows for agent response generation.
 * Optional: use startGenerateResponseWorkflow instead of scheduler.runAfter for retries/resumption.
 */
import { WorkflowManager } from "@convex-dev/workflow";
import { internal } from "../_generated/api";
import { components } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    retryActionsByDefault: false,
  },
});

/**
 * Durable workflow that runs generateResponse with retries on transient failures.
 * Use this when you want durable execution instead of a one-off scheduled action.
 */
export const generateResponseWorkflow = workflow.define({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web"))
    ),
  },
  returns: v.null(),
  handler: async (
    step,
    { threadId, promptMessageId, channel }
  ): Promise<void> => {
    await step.runAction(
      internal.agents.actions.generateResponse,
      { threadId, promptMessageId, channel },
      { retry: true, name: "generateResponse" }
    );
  },
});

/**
 * Start the durable generateResponse workflow. Use instead of
 * ctx.scheduler.runAfter(internal.agents.actions.generateResponse, ...)
 * when you want retries and resumption on failure.
 */
export const startGenerateResponseWorkflow = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web"))
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    const wf = internal.agents.workflows.generateResponseWorkflow;
    return workflow.start(ctx, wf, args);
  },
});
