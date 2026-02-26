export type LLMMode = "local" | "openrouter" | "server";

export type AgentLLMConfig =
  | {
      mode: "local";
      model: string;
      baseURL: string;
      apiKey?: string;
    }
  | {
      mode: "openrouter";
      model: string;
      apiKey: string;
    }
  | {
      mode: "server";
      model: string;
      baseURL: string;
      apiKey?: string;
    };

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_LOCAL_MODEL = "google/gemma-3-4b";
const DEFAULT_OPENROUTER_MODEL = "moonshotai/kimi-k2-thinking";
const DEFAULT_LLM_TIMEOUT_MS = 15000; // 15s – set LLM_TIMEOUT_MS to override (plan: 15–20s for fewer false timeouts)
const DEFAULT_LLM_MAX_RETRIES = 0;
const DEFAULT_PRODUCTION_MODEL = "moonshotai/kimi-k2-thinking";

function isFreeModelId(model: string): boolean {
  return /(^|:)\s*free$/i.test(model.trim());
}

function enforcePaidModel(model: string): string {
  if (!isFreeModelId(model)) return model;
  return process.env.AGENT_PROD_PRIMARY_MODEL?.trim() || DEFAULT_PRODUCTION_MODEL;
}

function parseMode(raw: string | undefined): LLMMode {
  const v = (raw ?? "").toLowerCase().trim();
  if (v === "local" || v === "openrouter" || v === "server") return v;
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "local";
}

export function getAgentLLMConfig(): AgentLLMConfig {
  const mode = parseMode(process.env.LLM_MODE);

  if (mode === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "LLM_MODE=openrouter requires OPENROUTER_API_KEY (set in Convex dashboard)",
      );
    }
    return {
      mode: "openrouter",
      model: enforcePaidModel(
        process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
      ),
      apiKey,
    };
  }

  if (mode === "local") {
    return {
      mode: "local",
      model: enforcePaidModel(process.env.LLM_MODEL ?? DEFAULT_LOCAL_MODEL),
      baseURL: process.env.LLM_BASE_URL ?? DEFAULT_LOCAL_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
    };
  }

  const baseURL = process.env.LLM_BASE_URL;
  if (!baseURL) {
    throw new Error(
      "LLM_MODE=server requires LLM_BASE_URL (set in Convex dashboard)",
    );
  }
  return {
    mode: "server",
    model: enforcePaidModel(
      process.env.LLM_MODEL ?? DEFAULT_OPENROUTER_MODEL,
    ),
    baseURL,
    apiKey: process.env.LLM_API_KEY,
  };
}

export function getAgentLLMConfigSafe(): { mode: string; model: string } | null {
  try {
    const config = getAgentLLMConfig();
    return { mode: config.mode, model: config.model };
  } catch {
    return null;
  }
}

export function getLLMTimeoutMs(): number {
  const raw = process.env.LLM_TIMEOUT_MS;
  if (raw == null || raw === "") return DEFAULT_LLM_TIMEOUT_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LLM_TIMEOUT_MS;
}

export function getLLMMaxRetries(): number {
  const raw = process.env.LLM_MAX_RETRIES;
  if (raw == null || raw === "") return DEFAULT_LLM_MAX_RETRIES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LLM_MAX_RETRIES;
}

const DEFAULT_TOKEN_LIMIT_FREE = 20_000;
const DEFAULT_TOKEN_LIMIT_PAID = 100_000;

/**
 * Default token limit for a user based on plan type.
 * Override via AGENT_TOKEN_LIMIT_FREE and AGENT_TOKEN_LIMIT_PAID env vars.
 */
export function getDefaultTokenLimitForPlan(planType?: "free" | "paid"): number {
  if (planType === "paid") {
    const raw = process.env.AGENT_TOKEN_LIMIT_PAID;
    if (raw != null && raw !== "") {
      const n = parseInt(raw.trim(), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return DEFAULT_TOKEN_LIMIT_PAID;
  }
  const raw = process.env.AGENT_TOKEN_LIMIT_FREE;
  if (raw != null && raw !== "") {
    const n = parseInt(raw.trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_TOKEN_LIMIT_FREE;
}
