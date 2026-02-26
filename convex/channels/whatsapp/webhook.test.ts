import { describe, expect, it } from "vitest";
import {
  buildSinglePropertyDetailQueue,
  buildWhatsAppOfferSendQueue,
  ensureOfferQueueHasImageFallback,
  normalizeWhatsAppImageUrls,
  normalizeWhatsAppOfferBlocks,
  parseQuickReplyIntent,
  parseVoiceConfirmationDecision,
} from "./webhook";

describe("normalizeWhatsAppImageUrls", () => {
  it("uses imageUrls when provided, deduplicates, and caps to 8 by default", () => {
    const result = normalizeWhatsAppImageUrls(undefined, [
      "https://img.example.com/1.jpg",
      "https://img.example.com/2.jpg",
      "https://img.example.com/2.jpg",
      "https://img.example.com/3.jpg",
      "https://img.example.com/4.jpg",
      "https://img.example.com/5.jpg",
      "https://img.example.com/6.jpg",
    ]);

    expect(result).toEqual([
      "https://img.example.com/1.jpg",
      "https://img.example.com/2.jpg",
      "https://img.example.com/3.jpg",
      "https://img.example.com/4.jpg",
      "https://img.example.com/5.jpg",
      "https://img.example.com/6.jpg",
    ]);
  });

  it("falls back to single imageUrl when imageUrls is missing", () => {
    const result = normalizeWhatsAppImageUrls("https://img.example.com/single.jpg");
    expect(result).toEqual(["https://img.example.com/single.jpg"]);
  });

  it("returns empty array when no images are present", () => {
    const result = normalizeWhatsAppImageUrls(undefined, []);
    expect(result).toEqual([]);
  });
});

describe("normalizeWhatsAppOfferBlocks", () => {
  it("keeps order and removes empty text blocks", () => {
    const result = normalizeWhatsAppOfferBlocks([
      { text: " Offer 1 ", imageUrl: "https://img.example.com/1.jpg" },
      { text: "   ", imageUrl: "https://img.example.com/ignored.jpg" },
      { text: "Offer 2" },
    ]);

    expect(result).toEqual([
      {
        text: "Offer 1",
        imageUrl: "https://img.example.com/1.jpg",
        imageUrls: ["https://img.example.com/1.jpg"],
      },
      {
        text: "Offer 2",
        imageUrl: undefined,
        imageUrls: [],
      },
    ]);
  });
});

describe("buildWhatsAppOfferSendQueue", () => {
  it("builds compact queue with one message block per property", () => {
    const queue = buildWhatsAppOfferSendQueue([
      { text: "Offer one details", imageUrl: "https://img.example.com/1.jpg" },
      { text: "Offer two details" },
      { text: "Offer three details", imageUrl: "https://img.example.com/3.jpg" },
    ]);

    // Per property: image_with_caption first when image exists.
    expect(queue).toEqual([
      {
        type: "image_with_caption",
        text: "Offer one details\nReply with offer number (1/2/3) for details, or say: compare.\nWould you like me to take the next step now?",
        imageUrl: "https://img.example.com/1.jpg",
      },
      {
        type: "text",
        text: "Offer two details\nReply with offer number (1/2/3) for details, or say: compare.\nWould you like me to take the next step now?",
      },
      {
        type: "image_with_caption",
        text: "Offer three details\nReply with offer number (1/2/3) for details, or say: compare.\nWould you like me to take the next step now?",
        imageUrl: "https://img.example.com/3.jpg",
      },
    ]);
  });

  it("returns empty queue when no valid offer blocks exist (legacy fallback path)", () => {
    const queue = buildWhatsAppOfferSendQueue([{ text: "   " }]);
    expect(queue).toEqual([]);
  });

  it("uses only first image for normal search queue", () => {
    const queue = buildWhatsAppOfferSendQueue([
      {
        text: "Offer with gallery",
        imageUrl: "https://img.example.com/1.jpg",
        imageUrls: [
          "https://img.example.com/1.jpg",
          "https://img.example.com/2.jpg",
          "https://img.example.com/3.jpg",
        ],
      },
    ]);
    expect(queue).toEqual([
      {
        type: "image_with_caption",
        text: "Offer with gallery\nReply with offer number (1/2/3) for details, or say: compare.\nWould you like me to take the next step now?",
        imageUrl: "https://img.example.com/1.jpg",
      },
    ]);
  });

  it("keeps one block per offer even when multiple imageUrls exist", () => {
    const queue = buildWhatsAppOfferSendQueue(
      [
        {
          text: "Property 1",
          imageUrl: "https://img.example.com/a1.jpg",
          imageUrls: ["https://img.example.com/a1.jpg", "https://img.example.com/a2.jpg"],
        },
        {
          text: "Property 2",
          imageUrl: "https://img.example.com/b1.jpg",
          imageUrls: ["https://img.example.com/b1.jpg", "https://img.example.com/b2.jpg"],
        },
      ],
      5
    );
    expect(queue).toHaveLength(2);
    expect(queue[0]).toEqual({
      type: "image_with_caption",
      text: "Property 1\nReply with offer number (1/2/3) for details, or say: compare.\nWould you like me to take the next step now?",
      imageUrl: "https://img.example.com/a1.jpg",
    });
    expect(queue[1]).toEqual({
      type: "image_with_caption",
      text: "Property 2\nReply with offer number (1/2/3) for details, or say: compare.\nWould you like me to take the next step now?",
      imageUrl: "https://img.example.com/b1.jpg",
    });
  });

  it("uses suggested action label as contextual CTA when provided", () => {
    const queue = buildWhatsAppOfferSendQueue(
      [{ text: "Property 1", imageUrl: "https://img.example.com/a1.jpg" }],
      3,
      {
        responseMode: "search_list",
        suggestedActions: [
          { id: "compare", label: "قارن بينهم الآن", action: "قارن" },
        ],
      },
    );
    expect(queue[0]).toEqual({
      type: "image_with_caption",
      text: "Property 1\nقارن بينهم الآن\nتحب أعرض لك الخطوة الجاية الآن؟",
      imageUrl: "https://img.example.com/a1.jpg",
    });
  });
});

describe("buildSinglePropertyDetailQueue", () => {
  it("sends all images first, then one text block without forced link", () => {
    const queue = buildSinglePropertyDetailQueue({
      text: "3BR apartment in Riyadh. Price: 1.2M SAR.",
      imageUrl: "https://img.example.com/1.jpg",
      imageUrls: [
        "https://img.example.com/1.jpg",
        "https://img.example.com/2.jpg",
        "https://img.example.com/3.jpg",
      ],
      link: "https://example.com/listing/123",
    });

    expect(queue).toHaveLength(4);
    expect(queue[0]).toEqual({ type: "image", imageUrl: "https://img.example.com/1.jpg" });
    expect(queue[1]).toEqual({ type: "image", imageUrl: "https://img.example.com/2.jpg" });
    expect(queue[2]).toEqual({ type: "image", imageUrl: "https://img.example.com/3.jpg" });
    expect(queue[3].type).toBe("text");
    expect((queue[3] as { type: "text"; text: string }).text).toContain("3BR apartment in Riyadh");
    expect((queue[3] as { type: "text"; text: string }).text).not.toContain(
      "https://example.com/listing/123"
    );
    expect((queue[3] as { type: "text"; text: string }).text).toContain(
      "viewing booking"
    );
    expect((queue[3] as { type: "text"; text: string }).text).toMatch(/[?؟]$/);
  });

  it("handles block with single imageUrl", () => {
    const queue = buildSinglePropertyDetailQueue({
      text: "Villa in Jeddah",
      imageUrl: "https://img.example.com/solo.jpg",
    });
    expect(queue).toHaveLength(2);
    expect(queue[0]).toEqual({ type: "image", imageUrl: "https://img.example.com/solo.jpg" });
    expect(queue[1].type).toBe("text");
  });
});

describe("ensureOfferQueueHasImageFallback", () => {
  it("upgrades first text offer to image_with_caption when fallback image exists", () => {
    const queue = ensureOfferQueueHasImageFallback(
      [
        { type: "text", text: "Offer one details" },
        { type: "text", text: "Offer two details" },
      ],
      ["https://img.example.com/fallback.jpg"]
    );

    expect(queue[0]).toEqual({
      type: "image_with_caption",
      text: "Offer one details",
      imageUrl: "https://img.example.com/fallback.jpg",
    });
    expect(queue[1]).toEqual({
      type: "text",
      text: "Offer two details",
    });
  });

  it("keeps queue unchanged when it already has image_with_caption", () => {
    const queue = ensureOfferQueueHasImageFallback(
      [
        { type: "image_with_caption", text: "Offer one", imageUrl: "https://img.example.com/1.jpg" },
        { type: "text", text: "Offer two" },
      ],
      ["https://img.example.com/fallback.jpg"]
    );
    expect(queue[0]).toEqual({
      type: "image_with_caption",
      text: "Offer one",
      imageUrl: "https://img.example.com/1.jpg",
    });
  });
});

describe("parseQuickReplyIntent", () => {
  it("maps numeric replies to property details intent", () => {
    const parsed = parseQuickReplyIntent("#2");
    expect(parsed.intent).toBe("details_k");
    expect(parsed.normalizedMessage).toBe("تفاصيل عن #2");
  });

  it("maps compare phrase to compare intent", () => {
    const parsed = parseQuickReplyIntent("compare");
    expect(parsed.intent).toBe("compare_top");
  });
});

describe("parseVoiceConfirmationDecision", () => {
  it("detects confirmation in Arabic", () => {
    const parsed = parseVoiceConfirmationDecision("نعم، كمل");
    expect(parsed.decision).toBe("confirm");
  });

  it("detects correction with payload", () => {
    const parsed = parseVoiceConfirmationDecision("تعديل: أبي شقة في جدة");
    expect(parsed.decision).toBe("correct");
    expect(parsed.correctedText).toBe("أبي شقة في جدة");
  });
});
