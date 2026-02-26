import { internal } from "../../_generated/api";
import { inferMemoryFactsFromMessage } from "../anan/memory/inference";

export async function persistInferredMemoryFacts(
  ctx: { runMutation: Function },
  params: { userId: string | undefined; threadId?: string; message: string },
): Promise<void> {
  if (!params.userId) return;
  const facts = inferMemoryFactsFromMessage(params.message);
  for (const fact of facts) {
    try {
      await ctx.runMutation(internal.services.memory.storeInternal, {
        userId: params.userId,
        threadId: params.threadId,
        memoryType: fact.memoryType,
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence,
        source: fact.source,
      });
    } catch (error) {
      console.warn("[memory] storeInternal failed:", {
        key: fact.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
