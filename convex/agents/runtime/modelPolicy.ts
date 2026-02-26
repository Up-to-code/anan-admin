import { isProductionAgentEnv } from "./env";

const FREE_MODEL_PATTERN = /(^|:)\s*free$/i;

export function isFreeModelId(model: string): boolean {
  return FREE_MODEL_PATTERN.test(model.trim());
}

export function assertProductionModelPolicy(args: {
  selectedModel?: string;
  defaultModel?: string;
  fallbacks?: string[];
}): void {
  if (!isProductionAgentEnv()) return;
  const candidates = [args.selectedModel, ...(args.fallbacks ?? []), args.defaultModel]
    .filter((item): item is string => Boolean(item && item.trim().length > 0));
  const freeModels = candidates.filter((item) => isFreeModelId(item));
  if (freeModels.length > 0) {
    throw new Error(`Production model chain contains free models: ${freeModels.join(", ")}`);
  }
}
