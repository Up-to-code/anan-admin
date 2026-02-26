import { isRateLimitedError } from "../modelFailover";

const modelCooldownUntilMs = new Map<string, number>();
const BASE_FAILOVER_DELAY_MS = 200;
const MAX_FAILOVER_DELAY_MS = 2000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

export async function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function getModelCooldownUntil(model: string): number | undefined {
  const until = modelCooldownUntilMs.get(model);
  if (typeof until !== "number") return undefined;
  if (until <= Date.now()) {
    modelCooldownUntilMs.delete(model);
    return undefined;
  }
  return until;
}

function parseRateLimitResetMs(error: unknown): number | undefined {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const obj = current as {
      responseHeaders?: Record<string, unknown>;
      headers?: Record<string, unknown>;
      cause?: unknown;
      lastError?: unknown;
      errors?: unknown[];
      data?: { error?: { metadata?: { headers?: Record<string, unknown> } } };
    };
    const headersCandidates = [
      obj.responseHeaders,
      obj.headers,
      obj.data?.error?.metadata?.headers,
    ];
    for (const headers of headersCandidates) {
      if (!headers || typeof headers !== "object") continue;
      const raw =
        headers["x-ratelimit-reset"] ??
        headers["X-RateLimit-Reset"] ??
        headers["x-rate-limit-reset"];
      if (typeof raw !== "string" && typeof raw !== "number") continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) continue;
      return parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
    }
    if (obj.cause) queue.push(obj.cause);
    if (obj.lastError) queue.push(obj.lastError);
    if (Array.isArray(obj.errors)) queue.push(...obj.errors);
  }
  return undefined;
}

export function markModelRateLimited(model: string, error: unknown): void {
  const now = Date.now();
  const parsedReset = parseRateLimitResetMs(error);
  const untilFromReset =
    typeof parsedReset === "number" ? parsedReset + 1000 : undefined;
  const untilFromDefault = now + DEFAULT_RATE_LIMIT_COOLDOWN_MS;
  const until = Math.min(
    untilFromReset && untilFromReset > now ? untilFromReset : untilFromDefault,
    now + MAX_RATE_LIMIT_COOLDOWN_MS,
  );
  modelCooldownUntilMs.set(model, until);
}

export function getFailoverDelayMs(error: unknown, attemptIndex: number): number {
  const backoff = Math.min(
    BASE_FAILOVER_DELAY_MS * Math.max(1, attemptIndex + 1),
    MAX_FAILOVER_DELAY_MS,
  );
  if (isRateLimitedError(error)) {
    return Math.min(backoff + 300, MAX_FAILOVER_DELAY_MS);
  }
  return backoff;
}
