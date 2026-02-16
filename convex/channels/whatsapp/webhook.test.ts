import { describe, expect, it } from "vitest";
import {
  buildWhatsAppOfferSendQueue,
  ensureOfferQueueHasImageFallback,
  normalizeWhatsAppImageUrls,
  normalizeWhatsAppOfferBlocks,
} from "./webhook";

describe("normalizeWhatsAppImageUrls", () => {
  it("uses imageUrls when provided, deduplicates, and caps to 5", () => {
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
  it("builds queue with first image+caption then compact CTA per property", () => {
    const queue = buildWhatsAppOfferSendQueue([
      { text: "Offer one details", imageUrl: "https://img.example.com/1.jpg" },
      { text: "Offer two details" },
      { text: "Offer three details", imageUrl: "https://img.example.com/3.jpg" },
    ]);

    // Per property: image_with_caption first when image exists.
    expect(queue).toEqual([
      {
        type: "image_with_caption",
        text: "Offer one details",
        imageUrl: "https://img.example.com/1.jpg",
        extraImageUrls: [],
      },
      {
        type: "text",
        text: "If this option fits you, reply with interested and I will arrange the next step.",
      },
      { type: "text", text: "Offer two details" },
      {
        type: "image_with_caption",
        text: "Offer three details",
        imageUrl: "https://img.example.com/3.jpg",
        extraImageUrls: [],
      },
      {
        type: "text",
        text: "If this option fits you, reply with interested and I will arrange the next step.",
      },
    ]);
  });

  it("returns empty queue when no valid offer blocks exist (legacy fallback path)", () => {
    const queue = buildWhatsAppOfferSendQueue([{ text: "   " }]);
    expect(queue).toEqual([]);
  });

  it("sends first image with caption, then extra images, then compact CTA", () => {
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
        text: "Offer with gallery",
        imageUrl: "https://img.example.com/1.jpg",
        extraImageUrls: [
          "https://img.example.com/2.jpg",
          "https://img.example.com/3.jpg",
        ],
      },
      {
        type: "text",
        text: "If this option fits you, reply with interested and I will arrange the next step.",
      },
    ]);
  });

  it("preserves multiple images per offer for 2+ offer blocks", () => {
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
    expect(queue).toHaveLength(4);
    expect(queue[0]).toEqual({
      type: "image_with_caption",
      text: "Property 1",
      imageUrl: "https://img.example.com/a1.jpg",
      extraImageUrls: ["https://img.example.com/a2.jpg"],
    });
    expect(queue[1]).toEqual({
      type: "text",
      text: "If this option fits you, reply with interested and I will arrange the next step.",
    });
    expect(queue[2]).toEqual({
      type: "image_with_caption",
      text: "Property 2",
      imageUrl: "https://img.example.com/b1.jpg",
      extraImageUrls: ["https://img.example.com/b2.jpg"],
    });
    expect(queue[3]).toEqual({
      type: "text",
      text: "If this option fits you, reply with interested and I will arrange the next step.",
    });
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
      extraImageUrls: [],
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
