/**
 * Cost tracking – wraps neutral-cost for AI and tool cost attribution.
 *
 * Token recording: All agent paths flow through the Agent usageHandler (createAnanAgent in
 * agents/anan/agent.ts). Entry points: generateResponse (app/web via sendMessage),
 * generateReplyAndReturnText (WhatsApp, HTTP). Both use getAgentByModel().generateText()
 * which invokes the usageHandler → recordAgentUsage → insertAgentUsage + incrementUserTokensUsed.
 */
import { components, internal } from "./_generated/api";
import { CostComponent } from "neutral-cost";

const costs = new CostComponent(components.neutralCost);

/** Usage handler for the agent – records AI token usage to cost component. */
export async function recordAgentUsage(
  ctx: {
    runQuery?: (fn: any, args: any) => Promise<any>;
    runAction?: (fn: any, args: any) => Promise<any>;
    runMutation?: (fn: any, args: any) => Promise<any>;
  },
  args: {
    userId: string | undefined;
    threadId: string | undefined;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cachedInputTokens?: number;
      reasoningTokens?: number;
    };
    model: string;
    provider: string;
  }
): Promise<void> {
  const { userId, threadId, usage, model, provider } = args;
  if (!threadId) return;
  const messageId = `usage_${threadId}_${Date.now()}`;
  try {
    const pricing = await costs.getPricing(ctx as any, model, provider);
    if (!pricing) return;
    await costs.addAICost(ctx as any, {
      messageId,
      userId,
      threadId,
      usage: {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        cachedInputTokens: usage.cachedInputTokens,
        reasoningTokens: usage.reasoningTokens,
      },
      modelId: model,
      providerId: provider,
    });
    if (typeof (ctx as any).runMutation === "function") {
      try {
        await (ctx as any).runMutation(internal.admin.agentUsage.insertAgentUsage, {
          userId,
          threadId,
          model,
          provider,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          cachedInputTokens: usage.cachedInputTokens,
          reasoningTokens: usage.reasoningTokens,
        });
        if (userId && usage.totalTokens > 0) {
          try {
            await (ctx as any).runMutation(
              internal.services.users.incrementUserTokensUsedInternal,
              { userId, tokensToAdd: usage.totalTokens },
            );
          } catch (e) {
            console.warn("[costs] incrementUserTokensUsed failed", e);
          }
        }
      } catch (e) {
        console.warn("[costs] insertAgentUsage failed", e);
      }
    }
  } catch (e) {
    console.warn("[costs] addAICost failed", e);
  }
}

/** Get total AI costs for a user (admin). */
export async function getTotalAICostsByUser(
  ctx: { runQuery: (fn: any, args: any) => Promise<any> },
  userId: string
) {
  return costs.getTotalAICostsByUser(ctx as any, userId);
}

/** Get tool costs for a user (admin). */
export async function getToolCostsByUser(
  ctx: { runQuery: (fn: any, args: any) => Promise<any> },
  userId: string
) {
  return costs.getToolCostsByUser(ctx as any, userId);
}
