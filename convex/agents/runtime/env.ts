import { isTruthyEnv, fnv1aHash } from "../_lib/utils";

export function isAgentTestActionsEnabled(): boolean {
  return isTruthyEnv(process.env.AGENT_TEST_ACTIONS);
}

function parsePercent(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
}



export function getAgentEnvironment(): "production" | "development" {
  const raw = (process.env.AGENT_ENV ?? "").trim().toLowerCase();
  return raw === "production" ? "production" : "development";
}

export function isProductionAgentEnv(): boolean {
  return getAgentEnvironment() === "production";
}

export function isSearchOrchestratorEnabled(): boolean {
  const raw = process.env.SEARCH_ORCH_ENABLED;
  if (raw === undefined || raw === "") return true;
  return isTruthyEnv(raw);
}

export function getSearchOrchestratorCanaryPercent(): number {
  return parsePercent(process.env.SEARCH_ORCH_CANARY_PERCENT, 100);
}

export function isSearchOrchestratorEnabledForKey(routingKey: string): boolean {
  if (!isSearchOrchestratorEnabled()) return false;
  const canaryPercent = getSearchOrchestratorCanaryPercent();
  if (canaryPercent >= 100) return true;
  if (canaryPercent <= 0) return false;
  return fnv1aHash(routingKey) % 100 < canaryPercent;
}
