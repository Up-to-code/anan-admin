/**
 * Shared model failover helpers (routing/fallback/error classification).
 */

export const DEFAULT_PAID_MODEL_FALLBACKS = [
  "openai/gpt-4o",
] as const;

export function parseModelList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildModelFallbackChain(args: {
  selectedModel?: string;
  defaultModel?: string | null;
  configuredFallbacksRaw?: string;
  demoFallbacksRaw?: string;
  demoDefaults?: readonly string[];
}): string[] {
  const isFreeModel = (model: string) => /(^|:)\s*free$/i.test(model);
  const keepPaidOnly = (models: string[]) =>
    models.filter((model) => !isFreeModel(model));
  const configuredFallbacks = parseModelList(args.configuredFallbacksRaw);
  const configuredDemoFallbacks = parseModelList(args.demoFallbacksRaw);
  const demoDefaults = [...(args.demoDefaults ?? DEFAULT_PAID_MODEL_FALLBACKS)];
  const effectiveFallbacks =
    configuredFallbacks.length > 0
      ? configuredFallbacks
      : configuredDemoFallbacks.length > 0
        ? configuredDemoFallbacks
        : demoDefaults;

  const chain = keepPaidOnly([
    args.selectedModel ?? "",
    ...effectiveFallbacks,
    args.defaultModel ?? "",
  ]);
  const deduped: string[] = [];
  for (const model of chain) {
    if (!model) continue;
    if (deduped.includes(model)) continue;
    deduped.push(model);
  }
  return deduped;
}

function hasStatusCodeMarker(
  candidate: unknown,
  statuses: readonly number[],
): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const obj = candidate as {
    statusCode?: unknown;
    code?: unknown;
    data?: { error?: { code?: unknown } };
  };
  if (
    typeof obj.statusCode === "number" &&
    statuses.includes(obj.statusCode)
  ) {
    return true;
  }
  if (typeof obj.code === "number" && statuses.includes(obj.code)) return true;
  const nested = obj.data?.error?.code;
  return typeof nested === "number" && statuses.includes(nested);
}

function hasErrorStatusDeep(
  error: unknown,
  statuses: readonly number[],
): boolean {
  if (hasStatusCodeMarker(error, statuses)) return true;
  if (typeof error === "object" && error !== null) {
    const errObj = error as {
      cause?: unknown;
      lastError?: unknown;
      errors?: unknown[];
    };
    if (
      hasStatusCodeMarker(errObj.cause, statuses) ||
      hasStatusCodeMarker(errObj.lastError, statuses)
    ) {
      return true;
    }
    if (Array.isArray(errObj.errors)) {
      return errObj.errors.some((item) => hasStatusCodeMarker(item, statuses));
    }
  }
  return false;
}

export function isRateLimitedError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (
    /rate limit exceeded/i.test(text) ||
    /\b429\b/.test(text) ||
    /free-models-per-day-stealth/i.test(text) ||
    /limit_rpm/i.test(text)
  ) {
    return true;
  }
  return hasErrorStatusDeep(error, [429]);
}

export function isModelFailoverError(error: unknown): boolean {
  if (isRateLimitedError(error)) return true;
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (
    /no endpoints found/i.test(text) ||
    /does not support tool/i.test(text) ||
    /tool.*not supported/i.test(text) ||
    /model.*not found/i.test(text) ||
    /temporarily unavailable/i.test(text) ||
    /overloaded/i.test(text) ||
    /provider.*error/i.test(text)
  ) {
    return true;
  }
  // 400 usually means a permanent prompt/request bug. Do not fan out to every fallback model.
  // 402 is included for provider credit/plan constraints where another model may still work.
  return hasErrorStatusDeep(error, [402, 404, 408, 429, 500, 502, 503, 504]);
}

export function extractRateLimitMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const candidate = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return "rate_limited";
}
