import { describe, expect, it } from "vitest";
import {
  isRetryableTranscriptionError,
  transcribeWithRetry,
  transcribeWhatsAppAudio,
} from "./transcription";

describe("isRetryableTranscriptionError", () => {
  it("returns true for timeout errors", () => {
    expect(isRetryableTranscriptionError("Transcription timed out")).toBe(true);
    expect(isRetryableTranscriptionError("request timeout")).toBe(true);
  });

  it("returns true for 5xx and server/upload transient errors", () => {
    expect(isRetryableTranscriptionError("AssemblyAI 502")).toBe(true);
    expect(isRetryableTranscriptionError("server error")).toBe(true);
    expect(isRetryableTranscriptionError("upload failed")).toBe(true);
    expect(isRetryableTranscriptionError("temporarily unavailable")).toBe(true);
    expect(isRetryableTranscriptionError("network error")).toBe(true);
  });

  it("returns false for missing config", () => {
    expect(isRetryableTranscriptionError("Missing mediaId")).toBe(false);
    expect(isRetryableTranscriptionError("WHATSAPP_ACCESS_TOKEN not set")).toBe(false);
    expect(isRetryableTranscriptionError("ASSEMBLYAI_API_KEY not set")).toBe(false);
  });

  it("returns false for 400/401 and auth errors", () => {
    expect(isRetryableTranscriptionError("400 bad request")).toBe(false);
    expect(isRetryableTranscriptionError("401 unauthorized")).toBe(false);
    expect(isRetryableTranscriptionError("invalid payload")).toBe(false);
  });

  it("returns false for undefined/empty", () => {
    expect(isRetryableTranscriptionError(undefined)).toBe(false);
  });
});

describe("transcribeWhatsAppAudio", () => {
  it("returns failed when mediaId is missing", async () => {
    const result = await transcribeWhatsAppAudio({});
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Missing");
  });
});

describe("transcribeWithRetry", () => {
  it("returns immediately when mediaId is missing (no retries)", async () => {
    const result = await transcribeWithRetry({ maxAttempts: 3 });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Missing");
  });
});
