/**
 * Shared HTTP helpers for agent-side upstream calls with retry and timeout.
 */

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEFAULT_TIMEOUT_MS = readPositiveInt(process.env.WEB_FETCH_TIMEOUT_MS, 8000);
const DEFAULT_MAX_RETRIES = readPositiveInt(process.env.WEB_FETCH_MAX_RETRIES, 2);
const DEFAULT_BASE_DELAY_MS = readPositiveInt(
  process.env.WEB_FETCH_RETRY_BASE_DELAY_MS,
  250,
);
const DEFAULT_MAX_DELAY_MS = readPositiveInt(
  process.env.WEB_FETCH_RETRY_MAX_DELAY_MS,
  2000,
);
const DEFAULT_JITTER_MS = readPositiveInt(process.env.WEB_FETCH_RETRY_JITTER_MS, 150);

type JsonFetchRetryOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  retryableStatuses?: number[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRetryDelay(attempt: number, options: JsonFetchRetryOptions): number {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitterMs = options.jitterMs ?? DEFAULT_JITTER_MS;
  const jitter = Math.floor(Math.random() * Math.max(1, jitterMs));
  const backoff = baseDelayMs * Math.pow(2, attempt);
  return Math.min(backoff + jitter, maxDelayMs);
}

function isRetryableStatus(status: number, options: JsonFetchRetryOptions): boolean {
  const retryableStatuses =
    options.retryableStatuses ?? [408, 425, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(status);
}

function toErrorMessage(status: number, text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ").slice(0, 240);
  return `http_${status}${cleaned ? ` ${cleaned}` : ""}`;
}

export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  options: JsonFetchRetryOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      if (response.ok) {
        return (await response.json()) as T;
      }
      const text = await response.text().catch(() => "");
      const retryable = isRetryableStatus(response.status, options);
      if (!retryable || attempt >= maxRetries) {
        throw new Error(toErrorMessage(response.status, text));
      }
      await sleep(buildRetryDelay(attempt, options));
      continue;
    } catch (error) {
      lastError = error;
      const aborted =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";
      const retryable = aborted || error instanceof TypeError;
      if (!retryable || attempt >= maxRetries) {
        throw error;
      }
      await sleep(buildRetryDelay(attempt, options));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("http_request_failed");
}
