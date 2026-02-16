/**
 * Agent LLM configuration – single source for all agent model/provider settings.
 * All env vars are read from the Convex dashboard (cloud). Convex does not use a local .env for these.
 * Switch between local (LLM Studio), OpenRouter, or custom server via LLM_MODE.
 * Sync only; no Convex actions/queries.
 */

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
const DEFAULT_OPENROUTER_MODEL = "openrouter/aurora-alpha";
const DEFAULT_LLM_TIMEOUT_MS = 12700; // 12.7s – set LLM_TIMEOUT_MS (e.g. 1270) to override

function parseMode(raw: string | undefined): LLMMode {
  const v = (raw ?? "").toLowerCase().trim();
  if (v === "local" || v === "openrouter" || v === "server") return v;
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "local";
}

/**
 * Resolves agent LLM config from environment.
 * Convex reads these from the dashboard only (Settings → Environment Variables); no local .env.
 * For local/server modes with Convex (cloud): LLM_BASE_URL must be a publicly reachable URL
 * (e.g. tunnel or custom domain to your LLM). To use 127.0.0.1 (e.g. LLM Studio), run
 * Convex locally so the backend can reach it: npx convex dev --local.
 * LLM_API_KEY set in the dashboard is sent with each request (omit or leave empty for no auth).
 */
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
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
      apiKey,
    };
  }

  if (mode === "local") {
    // With Convex (cloud), LLM_BASE_URL must be publicly reachable (tunnel/custom domain); LLM_API_KEY from dashboard is sent with requests.
    return {
      mode: "local",
      model: process.env.LLM_MODEL ?? DEFAULT_LOCAL_MODEL,
      baseURL: process.env.LLM_BASE_URL ?? DEFAULT_LOCAL_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
    };
  }

  // mode === "server" – LLM_BASE_URL must be publicly reachable; LLM_API_KEY from dashboard is sent with requests.
  const baseURL = process.env.LLM_BASE_URL;
  if (!baseURL) {
    throw new Error(
      "LLM_MODE=server requires LLM_BASE_URL (set in Convex dashboard)",
    );
  }
  return {
    mode: "server",
    model: process.env.LLM_MODEL ?? DEFAULT_OPENROUTER_MODEL,
    baseURL,
    apiKey: process.env.LLM_API_KEY,
  };
}

/** Safe version for admin display – returns { mode, model } or null if config is invalid. */
export function getAgentLLMConfigSafe(): { mode: string; model: string } | null {
  try {
    const config = getAgentLLMConfig();
    return { mode: config.mode, model: config.model };
  } catch {
    return null;
  }
}

/** Timeout in ms for LLM calls. Default 12700 (12.7s). Set LLM_TIMEOUT_MS to override. */
export function getLLMTimeoutMs(): number {
  const raw = process.env.LLM_TIMEOUT_MS;
  if (raw == null || raw === "") return DEFAULT_LLM_TIMEOUT_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LLM_TIMEOUT_MS;
}
