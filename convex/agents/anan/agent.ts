/**
 * Anan agent – customer-facing real estate assistant.
 */

import { Agent } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { getLLMTimeoutMs } from "../config";
import { getChatModel, getEmbeddingModel } from "../../lib/providers";
import { recordAgentUsage } from "../../costs";
import { buildAgentInstructions } from "./instructions";
import { createAgentTools } from "./tools";
import type { AgentToolsApi } from "./tools";

/** Create the Anan agent with tools bound to the given api. */
export function createAnanAgent(appApi: AgentToolsApi) {
  const tools = createAgentTools(appApi);

  return new Agent(components.agent, {
    name: "Anan",
    languageModel: getChatModel(),
    textEmbeddingModel: getEmbeddingModel(),
    callSettings: { timeout: getLLMTimeoutMs() },
    instructions: buildAgentInstructions(),
    tools,
    maxSteps: 6,
    usageHandler: async (ctx, args) => {
      const u = args.usage as {
        promptTokens?: number;
        completionTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        cachedInputTokens?: number;
        reasoningTokens?: number;
      };
      const promptTokens = u.promptTokens ?? u.inputTokens ?? 0;
      const completionTokens = u.completionTokens ?? u.outputTokens ?? 0;
      await recordAgentUsage(ctx, {
        userId: args.userId,
        threadId: args.threadId,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: u.totalTokens ?? promptTokens + completionTokens,
          cachedInputTokens: u.cachedInputTokens,
          reasoningTokens: u.reasoningTokens,
        },
        model: args.model,
        provider: args.provider,
      });
    },
    contextOptions: {
      searchOptions: {
        limit: 10,
        textSearch: true,
        vectorSearch: true,
      },
    },
  });
}
