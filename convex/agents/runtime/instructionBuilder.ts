import { internal } from "../../_generated/api";
import {
  buildAgentInstructions,
  isPromptPolicyV2Enabled,
  PROMPT_POLICY_VERSION,
} from "../anan/instructions";
import type { AgentChannel } from "../actions/shared";

type MemoryContextSnapshot = {
  summary?: string;
  preferences?: Array<{ key?: string; value?: string }>;
  constraints?: Array<{ key?: string; value?: string }>;
} | null;

async function getRelevantMemoryContext(
  ctx: { runQuery: Function },
  userId: string | undefined,
  query: string,
): Promise<MemoryContextSnapshot> {
  if (!userId) return null;
  try {
    return await ctx.runQuery(internal.services.memory.getRelevantMemoriesByQuery, {
      userId,
      query,
    });
  } catch (error) {
    console.warn("[memory] getRelevantMemoriesByQuery failed:", error);
    return null;
  }
}

function buildMemoryInjection(memoryContext: MemoryContextSnapshot): string {
  if (!memoryContext) return "";
  const memorySummary = memoryContext.summary ?? "";
  const memoryPreferences = (memoryContext.preferences ?? [])
    .map((p) => `${p.key ?? ""}: ${p.value ?? ""}`.trim())
    .filter((x) => x && x !== ":")
    .join(", ");
  const memoryConstraints = (memoryContext.constraints ?? [])
    .map((c) => `${c.key ?? ""}: ${c.value ?? ""}`.trim())
    .filter((x) => x && x !== ":")
    .join(", ");
  return `
**REMEMBERED USER CONTEXT (DO NOT RE-ASK)**:
${memorySummary}
${memoryPreferences ? `Preferences: ${memoryPreferences}` : ""}
${memoryConstraints ? `Constraints: ${memoryConstraints}` : ""}
IMPORTANT: Use this context. Do NOT ask for information already in memory. If user says "show me properties" without specifying location/budget, check memory first.
`;
}

export function getPromptPolicyMetadata() {
  return {
    promptPolicyVersion: PROMPT_POLICY_VERSION,
    promptPolicyV2Enabled: isPromptPolicyV2Enabled(),
  };
}

export async function buildSystemInstructions(
  ctx: { runQuery: Function },
  params: {
    channel: AgentChannel | undefined;
    userId: string | undefined;
    query: string;
  },
): Promise<string> {
  const baseInstructions = buildAgentInstructions(params.channel);
  const memoryContext = await getRelevantMemoryContext(
    ctx,
    params.userId,
    params.query,
  );
  const memoryInjection = buildMemoryInjection(memoryContext);
  return [baseInstructions, memoryInjection].filter(Boolean).join("\n\n");
}
