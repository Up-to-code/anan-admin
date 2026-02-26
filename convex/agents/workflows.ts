/**
 * Durable workflows for agent response generation.
 * Optional: use startGenerateResponseWorkflow instead of scheduler.runAfter for retries/resumption.
 */
import { WorkflowManager } from "@convex-dev/workflow";
import { internal } from "../_generated/api";
import { components } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const WORKFLOW_MAX_ATTEMPTS = readPositiveInt(
  process.env.AGENT_WORKFLOW_MAX_ATTEMPTS,
  5,
);
const WORKFLOW_INITIAL_BACKOFF_MS = readPositiveInt(
  process.env.AGENT_WORKFLOW_INITIAL_BACKOFF_MS,
  250,
);
const WORKFLOW_BACKOFF_BASE = readPositiveInt(
  process.env.AGENT_WORKFLOW_BACKOFF_BASE,
  2,
);
const WORKFLOW_MAX_PARALLELISM = readPositiveInt(
  process.env.AGENT_WORKFLOW_MAX_PARALLELISM,
  60,
);
const WORKFLOW_RETRY_GENERATE_RESPONSE = readBoolean(
  process.env.AGENT_WORKFLOW_RETRY_GENERATE_RESPONSE,
  false,
);

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: WORKFLOW_MAX_ATTEMPTS,
      initialBackoffMs: WORKFLOW_INITIAL_BACKOFF_MS,
      base: WORKFLOW_BACKOFF_BASE,
    },
    retryActionsByDefault: false,
    maxParallelism: WORKFLOW_MAX_PARALLELISM,
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
      {
        retry: WORKFLOW_RETRY_GENERATE_RESPONSE,
        name: "generateResponse",
      }
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
