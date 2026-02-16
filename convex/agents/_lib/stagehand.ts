/**
 * Stagehand/Browserbase credentials from env.
 * Use when constructing Stagehand per https://www.convex.dev/components/stagehand
 */
export function getStagehandConfig():
  | { browserbaseApiKey: string; browserbaseProjectId: string; modelApiKey: string }
  | { error: string } {
  const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
  const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;
  const modelApiKey = process.env.MODEL_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!browserbaseApiKey || !browserbaseProjectId) {
    return {
      error: "BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID required.",
    };
  }
  if (!modelApiKey) {
    return {
      error: "MODEL_API_KEY or OPENAI_API_KEY required for Stagehand.",
    };
  }
  if (modelApiKey.startsWith("sk-or-")) {
    return {
      error: "OpenRouter keys not supported. Use OpenAI-compatible key in MODEL_API_KEY.",
    };
  }
  return { browserbaseApiKey, browserbaseProjectId, modelApiKey };
}
