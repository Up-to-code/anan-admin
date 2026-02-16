/**
 * Unit tests for WhatsApp webhook parsing.
 * Tests extractAllWebhookEvents and extractWebhookEvents with official payload structures.
 */
import { describe, expect, it } from "vitest";
import {
  extractAllWebhookEvents,
  extractWebhookEvents,
} from "./api";

const TEXT_MESSAGE_PAYLOAD = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551234567",
              phone_number_id: "pid123",
            },
            contacts: [{ profile: { name: "Test User" }, wa_id: "201015638178" }],
            messages: [
              {
                from: "201015638178",
                id: "wamid.abc",
                timestamp: "1234567890",
                type: "text",
                text: { body: "Hello, this is my OTP: 123456" },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
});

const STATUS_UPDATE_PAYLOAD = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551234567",
              phone_number_id: "pid123",
            },
            statuses: [
              {
                id: "wamid.xyz",
                status: "delivered",
                timestamp: "1234567890",
                recipient_id: "201015638178",
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
});

const REACTION_PAYLOAD = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551234567",
              phone_number_id: "pid123",
            },
            contacts: [{ profile: { name: "Test User" }, wa_id: "201015638178" }],
            messages: [
              {
                from: "201015638178",
                id: "wamid.reaction",
                timestamp: "1234567890",
                type: "reaction",
                reaction: {
                  message_id: "wamid.original",
                  emoji: "👍",
                },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
});

const MIXED_PAYLOAD = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          value: {
            metadata: { phone_number_id: "pid1", display_phone_number: "1555" },
            messages: [
              {
                from: "201015638178",
                id: "msg1",
                type: "text",
                text: { body: "OTP 654321" },
              },
            ],
            statuses: [
              { id: "s1", status: "sent", timestamp: "1", recipient_id: "1" },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
});

const EMPTY_PAYLOAD = JSON.stringify({});
const NO_ENTRY_PAYLOAD = JSON.stringify({ object: "whatsapp_business_account" });
const MALFORMED_PAYLOAD = "{ invalid json }";

describe("extractWebhookEvents", () => {
  it("extracts text message from value.messages", () => {
    const events = extractWebhookEvents(TEXT_MESSAGE_PAYLOAD);
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe("Hello, this is my OTP: 123456");
    expect(events[0].from).toBe("201015638178");
    expect(events[0].mediaType).toBe("text");
  });

  it("returns empty array for status-only payload", () => {
    const events = extractWebhookEvents(STATUS_UPDATE_PAYLOAD);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for empty body", () => {
    const events = extractWebhookEvents(EMPTY_PAYLOAD);
    expect(events).toHaveLength(0);
  });

  it("returns empty array when entry is missing", () => {
    const events = extractWebhookEvents(NO_ENTRY_PAYLOAD);
    expect(events).toHaveLength(0);
  });

  it("throws on malformed JSON", () => {
    expect(() => extractWebhookEvents(MALFORMED_PAYLOAD)).toThrow();
  });
});

describe("extractAllWebhookEvents", () => {
  it("extracts text message and returns in messages array", () => {
    const { messages, reactions } = extractAllWebhookEvents(TEXT_MESSAGE_PAYLOAD);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("Hello, this is my OTP: 123456");
    expect(messages[0].from).toBe("201015638178");
    expect(reactions).toHaveLength(0);
  });

  it("returns 0 messages for status-only payload", () => {
    const { messages, reactions } = extractAllWebhookEvents(STATUS_UPDATE_PAYLOAD);
    expect(messages).toHaveLength(0);
    expect(reactions).toHaveLength(0);
  });

  it("extracts reaction and returns in reactions array", () => {
    const { messages, reactions } = extractAllWebhookEvents(REACTION_PAYLOAD);
    expect(messages).toHaveLength(0);
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emoji).toBe("👍");
    expect(reactions[0].reactionMessageId).toBe("wamid.original");
    expect(reactions[0].from).toBe("201015638178");
  });

  it("extracts message from mixed payload (message + status)", () => {
    const { messages, reactions } = extractAllWebhookEvents(MIXED_PAYLOAD);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("OTP 654321");
    expect(reactions).toHaveLength(0);
  });

  it("returns empty arrays for empty body", () => {
    const { messages, reactions } = extractAllWebhookEvents(EMPTY_PAYLOAD);
    expect(messages).toHaveLength(0);
    expect(reactions).toHaveLength(0);
  });

  it("returns empty arrays when entry is missing", () => {
    const { messages, reactions } = extractAllWebhookEvents(NO_ENTRY_PAYLOAD);
    expect(messages).toHaveLength(0);
    expect(reactions).toHaveLength(0);
  });

  it("throws on malformed JSON", () => {
    expect(() => extractAllWebhookEvents(MALFORMED_PAYLOAD)).toThrow();
  });
});
