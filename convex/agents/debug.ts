export type AgentDebugPayload = Record<string, unknown>;

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isAgentDebugEnabled(): boolean {
  const env = process.env.NODE_ENV ?? "development";
  if (env === "production") return false;
  return isTruthy(process.env.AGENT_DEBUG_LOGS);
}

export function debugLog(scope: string, event: string, payload: AgentDebugPayload = {}): void {
  if (!isAgentDebugEnabled()) return;
  const timestamp = new Date().toISOString();
  console.debug(`[agent_debug] ${timestamp} ${scope}.${event}`, payload);
}

export async function withDebugTiming<T>(
  scope: string,
  event: string,
  payload: AgentDebugPayload,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  debugLog(scope, `${event}_start`, payload);
  try {
    const result = await fn();
    debugLog(scope, `${event}_success`, {
      ...payload,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    debugLog(scope, `${event}_error`, {
      ...payload,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
