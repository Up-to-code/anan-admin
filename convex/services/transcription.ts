import { getWhatsAppMediaDownloadUrl } from "../channels/whatsapp/api";

export type TranscriptionStatus = "success" | "failed" | "timeout";

export type TranscriptionFailureStep =
  | "media_url"
  | "media_download"
  | "assembly_upload"
  | "assembly_poll"
  | "timeout"
  | "unknown";

export type TranscriptionResult = {
  status: TranscriptionStatus;
  text?: string;
  latencyMs: number;
  error?: string;
  failureStep?: TranscriptionFailureStep;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_POLL_INTERVAL_MS = 800;

function getAssemblyHeaders() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not set");
  return { authorization: apiKey };
}

async function uploadAudioBytesToAssemblyAi(audioBytes: ArrayBuffer): Promise<string> {
  const res = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: getAssemblyHeaders(),
    body: audioBytes,
  });
  const data = (await res.json()) as { upload_url?: string; error?: string };
  if (!res.ok || !data.upload_url) {
    throw new Error(data.error ?? `AssemblyAI upload failed: ${res.status}`);
  }
  return data.upload_url;
}

async function startTranscription(audioUrl: string, languageCode: string): Promise<string> {
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      ...getAssemblyHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: languageCode,
      speech_model: "universal",
    }),
  });
  const data = (await res.json()) as { id?: string; error?: string };
  if (!res.ok || !data.id) {
    throw new Error(data.error ?? `AssemblyAI transcript start failed: ${res.status}`);
  }
  return data.id;
}

async function pollTranscription(
  transcriptId: string,
  timeoutMs: number,
  pollIntervalMs: number,
): Promise<{ status: TranscriptionStatus; text?: string; error?: string }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      method: "GET",
      headers: getAssemblyHeaders(),
    });
    const data = (await res.json()) as {
      status?: string;
      text?: string;
      error?: string;
    };
    if (!res.ok) {
      return { status: "failed", error: data.error ?? `AssemblyAI polling failed: ${res.status}` };
    }
    if (data.status === "completed") {
      return { status: "success", text: data.text ?? "" };
    }
    if (data.status === "error") {
      return { status: "failed", error: data.error ?? "AssemblyAI returned error state" };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return { status: "timeout", error: "Transcription timed out" };
}

export async function transcribeWhatsAppAudio(params: {
  mediaId?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  languageCode?: string;
}): Promise<TranscriptionResult> {
  const start = Date.now();
  const fail = (
    step: TranscriptionFailureStep,
    message: string,
  ): TranscriptionResult => ({
    status: "failed",
    latencyMs: Date.now() - start,
    error: `${step}: ${message}`,
    failureStep: step,
  });

  try {
    if (!params.mediaId) {
      return fail("unknown", "Missing mediaId");
    }
    if (!process.env.ASSEMBLYAI_API_KEY) {
      return fail("unknown", "ASSEMBLYAI_API_KEY not set");
    }
    const media = await getWhatsAppMediaDownloadUrl(params.mediaId);
    if (!media.success || !media.url) {
      return fail("media_url", media.error ?? "Could not resolve media URL");
    }
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      return fail("media_url", "WHATSAPP_ACCESS_TOKEN not set");
    }
    const audioRes = await fetch(media.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) {
      return fail("media_download", `Media download failed: ${audioRes.status}`);
    }
    const audioBytes = await audioRes.arrayBuffer();
    let uploadUrl: string;
    try {
      uploadUrl = await uploadAudioBytesToAssemblyAi(audioBytes);
    } catch (e) {
      return fail(
        "assembly_upload",
        e instanceof Error ? e.message : "AssemblyAI upload failed",
      );
    }
    let transcriptId: string;
    try {
      transcriptId = await startTranscription(
        uploadUrl,
        params.languageCode ?? process.env.ASSEMBLYAI_LANGUAGE_CODE ?? "ar",
      );
    } catch (e) {
      return fail(
        "assembly_upload",
        e instanceof Error ? e.message : "AssemblyAI transcript start failed",
      );
    }
    const poll = await pollTranscription(
      transcriptId,
      params.timeoutMs ?? Number(process.env.ASSEMBLYAI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
      params.pollIntervalMs ??
        Number(process.env.ASSEMBLYAI_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS),
    );
    if (poll.status === "timeout") {
      return {
        status: "timeout",
        error: poll.error,
        latencyMs: Date.now() - start,
        failureStep: "timeout",
      };
    }
    if (poll.status === "failed") {
      return fail("assembly_poll", poll.error ?? "Transcription failed");
    }
    return {
      status: poll.status,
      text: poll.text,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return fail(
      "unknown",
      error instanceof Error ? error.message : "Unknown transcription error",
    );
  }
}

/**
 * Whether a transcription failure is likely transient and safe to retry.
 * Retry on: timeout, 5xx, server, upload, network, temporarily.
 * No retry on: missing mediaId, missing API keys, 400/401, invalid payload.
 */
export function isRetryableTranscriptionError(error: string | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  if (/timeout|timed out/i.test(lower)) return true;
  if (/\b5\d\d\b|server error|upload failed|upload error/i.test(lower)) return true;
  if (/network|temporarily|temporary|unavailable/i.test(lower)) return true;
  if (/missing mediaid|missing api|whatsapp_access_token not set|assemblyai_api_key not set/i.test(lower))
    return false;
  if (/400|401|invalid|forbidden|unauthorized/i.test(lower)) return false;
  return false;
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEFAULT_TRANSCRIPTION_RETRY_ATTEMPTS = 3;
const DEFAULT_TRANSCRIPTION_RETRY_BASE_DELAY_MS = 1000;

export async function transcribeWithRetry(params: {
  mediaId?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  languageCode?: string;
  maxAttempts?: number;
  baseDelayMs?: number;
}): Promise<TranscriptionResult> {
  const maxAttempts =
    params.maxAttempts ??
    readPositiveInt(process.env.WA_TRANSCRIPTION_RETRY_ATTEMPTS, DEFAULT_TRANSCRIPTION_RETRY_ATTEMPTS);
  const baseDelayMs =
    params.baseDelayMs ??
    readPositiveInt(process.env.WA_TRANSCRIPTION_RETRY_BACKOFF_MS, DEFAULT_TRANSCRIPTION_RETRY_BASE_DELAY_MS);
  let lastResult: TranscriptionResult = {
    status: "failed",
    latencyMs: 0,
    error: "No attempts",
  };
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await transcribeWhatsAppAudio({
      mediaId: params.mediaId,
      timeoutMs: params.timeoutMs,
      pollIntervalMs: params.pollIntervalMs,
      languageCode: params.languageCode,
    });
    lastResult = result;
    if (result.status === "success") return result;
    if (result.status === "timeout") {
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
      continue;
    }
    if (!isRetryableTranscriptionError(result.error)) return result;
    if (attempt < maxAttempts - 1) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return lastResult;
}

/**
 * Transforms a voice note (audio) to text via transcription.
 * Standardized interface for the WhatsApp voice flow.
 * On failure, returns empty text to avoid passing partial/empty content to the agent.
 */
export async function transformVoiceToText(mediaId: string): Promise<{
  text: string;
  status: "success" | "failed";
  latencyMs?: number;
  error?: string;
  failureStep?: TranscriptionFailureStep;
}> {
  const result = await transcribeWithRetry({ mediaId });
  if (result.status === "success" && result.text && result.text.trim().length > 0) {
    return { text: result.text.trim(), status: "success", latencyMs: result.latencyMs };
  }
  return {
    text: "",
    status: "failed",
    latencyMs: result.latencyMs,
    error: result.error,
    failureStep: result.failureStep,
  };
}
