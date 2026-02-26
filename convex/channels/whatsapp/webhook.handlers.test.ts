import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyWhatsAppSignatureMock,
  extractAllWebhookEventsMock,
  sendTextMock,
  markReadMock,
  sendTypingMock,
  transcribeMock,
  markInboundProcessingMock,
  markInboundDoneMock,
  markInboundFailedMock,
  insertInboundMessageMock,
  createPendingVoiceConfirmationMock,
  getPendingVoiceConfirmationMock,
  resolvePendingVoiceConfirmationMock,
  logDeliveryTurnSafeMock,
} = vi.hoisted(() => ({
  verifyWhatsAppSignatureMock: vi.fn(),
  extractAllWebhookEventsMock: vi.fn(),
  sendTextMock: vi.fn(),
  markReadMock: vi.fn(),
  sendTypingMock: vi.fn(),
  transcribeMock: vi.fn(),
  markInboundProcessingMock: vi.fn(),
  markInboundDoneMock: vi.fn(),
  markInboundFailedMock: vi.fn(),
  insertInboundMessageMock: vi.fn().mockResolvedValue(undefined),
  createPendingVoiceConfirmationMock: vi.fn(),
  getPendingVoiceConfirmationMock: vi.fn(),
  resolvePendingVoiceConfirmationMock: vi.fn(),
  logDeliveryTurnSafeMock: vi.fn(),
}));

vi.mock("./api", () => ({
  verifyWhatsAppSignature: verifyWhatsAppSignatureMock,
  extractAllWebhookEvents: extractAllWebhookEventsMock,
}));

vi.mock("./service", () => ({
  WhatsAppService: class {
    markRead = markReadMock;
    sendTyping = sendTypingMock;
    sendText = sendTextMock;
    sendImage = vi.fn();
    sendTextWithImage = vi.fn();
  },
}));

vi.mock("../../services/transcription", () => ({
  transcribeWithRetry: transcribeMock,
  async transformVoiceToText(mediaId: string) {
    const result = await transcribeMock({ mediaId });
    if (result.status === "success" && result.text && result.text.trim().length > 0) {
      return { text: result.text.trim(), status: "success" as const, latencyMs: result.latencyMs };
    }
    return {
      text: "",
      status: "failed" as const,
      latencyMs: result.latencyMs,
      error: result.error,
      failureStep: result.failureStep,
    };
  },
}));

vi.mock("./flow/inbound_dedup", () => ({
  markEventKey: vi.fn(({ type, id, fallback }) => (id ? `${type}:${id}` : `${type}:${fallback}`)),
  markInboundProcessing: markInboundProcessingMock,
  markInboundDone: markInboundDoneMock,
  markInboundFailed: markInboundFailedMock,
  insertInboundMessage: insertInboundMessageMock,
}));

vi.mock("./flow/voice_confirmation", () => ({
  createDefaultVoiceState: vi.fn(() => ({
    transcriptionStatus: "not_applicable",
    voiceConfirmationShown: false,
    voiceConfirmed: false,
    voiceCorrectionApplied: false,
  })),
  buildVoiceConfirmationPrompt: vi.fn((text: string) => ({
    prompt: `PROMPT:${text}`,
    summary: text,
    confidence: 0.9,
  })),
  createPendingVoiceConfirmation: createPendingVoiceConfirmationMock,
  getPendingVoiceConfirmation: getPendingVoiceConfirmationMock,
  resolvePendingVoiceConfirmation: resolvePendingVoiceConfirmationMock,
}));

vi.mock("./flow/delivery_metrics", () => ({
  logDeliveryTurnSafe: logDeliveryTurnSafeMock,
}));

import { handleWhatsAppWebhookGet, handleWhatsAppWebhookPost } from "./webhook";

describe("whatsapp webhook handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-token";
    process.env.WHATSAPP_APP_SECRET = "app-secret";
    process.env.WHATSAPP_SKIP_VERIFICATION = "false";
    process.env.WA_VOICE_CONFIRMATION_ENABLED = "true";
    process.env.WA_QUICK_REPLY_INTENTS_ENABLED = "true";
    process.env.WA_ENGAGEMENT_V2_ENABLED = "true";
    markInboundProcessingMock.mockResolvedValue(true);
    markInboundDoneMock.mockResolvedValue(undefined);
    markInboundFailedMock.mockResolvedValue(undefined);
    getPendingVoiceConfirmationMock.mockResolvedValue(null);
    verifyWhatsAppSignatureMock.mockResolvedValue(true);
    extractAllWebhookEventsMock.mockReturnValue({ messages: [], reactions: [] });
    transcribeMock.mockResolvedValue({ status: "failed", latencyMs: 10 });
  });

  it("returns 200 challenge for valid webhook verification", async () => {
    const request = new Request(
      "https://example.com/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=123",
    );
    const response = await handleWhatsAppWebhookGet({} as never, request);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("123");
  });

  it("returns 403 for invalid webhook verification token", async () => {
    const request = new Request(
      "https://example.com/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123",
    );
    const response = await handleWhatsAppWebhookGet({} as never, request);
    expect(response.status).toBe(403);
  });

  it("returns 401 when signature is invalid", async () => {
    verifyWhatsAppSignatureMock.mockResolvedValue(false);
    const request = new Request("https://example.com/api/webhook/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=bad" },
      body: JSON.stringify({}),
    });

    const response = await handleWhatsAppWebhookPost({} as never, request);
    expect(response.status).toBe(401);
    expect(extractAllWebhookEventsMock).not.toHaveBeenCalled();
  });

  it("runs voice confirmation flow before agent action", async () => {
    extractAllWebhookEventsMock.mockReturnValue({
      reactions: [],
      messages: [
        {
          from: "966500000000",
          messageId: "wamid-1",
          text: "",
          displayName: "Ahmed",
          phoneNumberId: "pid-1",
          mediaType: "audio",
          mediaId: "media-1",
        },
      ],
    });
    transcribeMock.mockResolvedValue({
      status: "success",
      text: "ابغى شقة غرفتين في دبي",
      latencyMs: 120,
    });

    const ctx = {
      runMutation: vi.fn().mockResolvedValue({}),
      runAction: vi.fn(),
      runQuery: vi.fn(),
    };

    const request = new Request("https://example.com/api/webhook/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=ok" },
      body: JSON.stringify({}),
    });

    const response = await handleWhatsAppWebhookPost(ctx as never, request);

    expect(response.status).toBe(200);
    expect(transcribeMock).toHaveBeenCalledWith({ mediaId: "media-1" });
    expect(createPendingVoiceConfirmationMock).toHaveBeenCalledTimes(1);
    expect(sendTextMock).toHaveBeenCalledWith(
      "966500000000",
      "PROMPT:ابغى شقة غرفتين في دبي",
      "wamid-1",
    );
    expect(ctx.runAction).not.toHaveBeenCalled();
    expect(logDeliveryTurnSafeMock).toHaveBeenCalledTimes(1);
  });

  it("sends Arabic fallback when transcription fails (voice confirmation ON)", async () => {
    extractAllWebhookEventsMock.mockReturnValue({
      reactions: [],
      messages: [
        {
          from: "966500000000",
          messageId: "wamid-1",
          text: "",
          displayName: "Ahmed",
          phoneNumberId: "pid-1",
          mediaType: "audio",
          mediaId: "media-1",
        },
      ],
    });
    transcribeMock.mockResolvedValue({ status: "failed", latencyMs: 10, error: "Upload failed" });

    const ctx = {
      runMutation: vi.fn().mockResolvedValue({}),
      runAction: vi.fn(),
      runQuery: vi.fn(),
    };

    const request = new Request("https://example.com/api/webhook/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=ok" },
      body: JSON.stringify({}),
    });

    const response = await handleWhatsAppWebhookPost(ctx as never, request);

    expect(response.status).toBe(200);
    expect(sendTextMock).toHaveBeenCalledWith(
      "966500000000",
      "وصلتني الملاحظة الصوتية لكن ما قدرت أفهمها بالكامل. أرسلها مرة ثانية بشكل أقصر أو اكتب المطلوب.",
      "wamid-1",
    );
  });

  it("sends transcript directly to agent when voice confirmation OFF and transcription succeeds", async () => {
    process.env.WA_VOICE_CONFIRMATION_ENABLED = "false";
    extractAllWebhookEventsMock.mockReturnValue({
      reactions: [],
      messages: [
        {
          from: "966500000000",
          messageId: "wamid-1",
          text: "",
          displayName: "Ahmed",
          phoneNumberId: "pid-1",
          mediaType: "audio",
          mediaId: "media-1",
        },
      ],
    });
    transcribeMock.mockResolvedValue({
      status: "success",
      text: "ابغى شقة غرفتين",
      latencyMs: 100,
    });

    const runActionMock = vi.fn().mockResolvedValue({
      text: "Agent reply",
      threadId: "thread-1",
    });
    const ctx = {
      runMutation: vi.fn().mockResolvedValue({}),
      runAction: runActionMock,
      runQuery: vi.fn(),
    };

    const request = new Request("https://example.com/api/webhook/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=ok" },
      body: JSON.stringify({}),
    });

    const response = await handleWhatsAppWebhookPost(ctx as never, request);

    expect(response.status).toBe(200);
    expect(createPendingVoiceConfirmationMock).not.toHaveBeenCalled();
    expect(runActionMock).toHaveBeenCalled();
    expect(sendTextMock).toHaveBeenCalledWith("966500000000", expect.any(String), "wamid-1");
  });

  it("sends fallback when voice confirmation OFF and transcription fails", async () => {
    process.env.WA_VOICE_CONFIRMATION_ENABLED = "false";
    extractAllWebhookEventsMock.mockReturnValue({
      reactions: [],
      messages: [
        {
          from: "966500000000",
          messageId: "wamid-1",
          text: "",
          displayName: "Ahmed",
          phoneNumberId: "pid-1",
          mediaType: "audio",
          mediaId: "media-1",
        },
      ],
    });
    transcribeMock.mockResolvedValue({ status: "failed", latencyMs: 5, error: "Missing mediaId" });

    const ctx = {
      runMutation: vi.fn().mockResolvedValue({}),
      runAction: vi.fn(),
      runQuery: vi.fn(),
    };

    const request = new Request("https://example.com/api/webhook/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=ok" },
      body: JSON.stringify({}),
    });

    const response = await handleWhatsAppWebhookPost(ctx as never, request);

    expect(response.status).toBe(200);
    expect(sendTextMock).toHaveBeenCalledWith(
      "966500000000",
      "وصلتني الملاحظة الصوتية لكن ما قدرت أفهمها بالكامل. أرسلها مرة ثانية بشكل أقصر أو اكتب المطلوب.",
      "wamid-1",
    );
  });
});
