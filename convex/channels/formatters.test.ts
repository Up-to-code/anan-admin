import { describe, expect, it } from "vitest";
import { formatForChannel } from "./formatters";

describe("formatForChannel", () => {
  it("extracts and strips image URL for whatsapp text", () => {
    const raw =
      "Here is a property image: https://foo.convex.site/api/storage/abc123 and details below.";
    const formatted = formatForChannel(raw, "whatsapp");

    expect(formatted.imageUrl).toBe("https://foo.convex.site/api/storage/abc123");
    expect(formatted.text).not.toContain("https://foo.convex.site/api/storage/abc123");
    expect(formatted.text).toContain("details below");
  });

  it("keeps app text unchanged while still extracting image URL", () => {
    const raw = "Listing photo https://img.example.com/home.jpg";
    const formatted = formatForChannel(raw, "app");

    expect(formatted.imageUrl).toBe("https://img.example.com/home.jpg");
    expect(formatted.text).toContain("https://img.example.com/home.jpg");
  });

  it("extracts image from tool output payload when provided", () => {
    const formatted = formatForChannel("No URL in text", "web", {
      extractImageFromToolOutput: {
        results: [{ imageUrl: "https://img.example.com/fallback.webp" }],
      },
    });

    expect(formatted.imageUrl).toBe("https://img.example.com/fallback.webp");
    expect(formatted.imageUrls).toBeUndefined();
    expect(formatted.text).toContain("No URL in text");
    expect(formatted.text).toContain("What would you like me to do next?");
  });

  it("returns top 5 unique imageUrls for whatsapp", () => {
    const formatted = formatForChannel("Results ready", "whatsapp", {
      extractImageFromToolOutput: {
        results: [
          { imageUrl: "https://img.example.com/1.jpg" },
          { imageUrl: "https://img.example.com/2.jpg" },
          { imageUrl: "https://img.example.com/3.jpg" },
          { imageUrl: "https://img.example.com/4.jpg" },
          { imageUrl: "https://img.example.com/5.jpg" },
          { imageUrl: "https://img.example.com/6.jpg" },
          { imageUrl: "https://img.example.com/2.jpg" },
        ],
      },
    });

    expect(formatted.imageUrl).toBe("https://img.example.com/1.jpg");
    expect(formatted.imageUrls).toEqual([
      "https://img.example.com/1.jpg",
      "https://img.example.com/2.jpg",
      "https://img.example.com/3.jpg",
      "https://img.example.com/4.jpg",
      "https://img.example.com/5.jpg",
    ]);
  });

  it("keeps app/web behavior single-image compatible", () => {
    const formatted = formatForChannel("Photo https://img.example.com/one.jpg", "app", {
      extractImageFromToolOutput: {
        results: [
          { imageUrl: "https://img.example.com/one.jpg" },
          { imageUrl: "https://img.example.com/two.jpg" },
        ],
      },
    });

    expect(formatted.imageUrl).toBe("https://img.example.com/one.jpg");
    expect(formatted.imageUrls).toBeUndefined();
    expect(formatted.text).toContain("https://img.example.com/one.jpg");
  });

  it("extracts CDN imageUrls without standard extensions from tool output", () => {
    // CDN URLs often don't end in .jpg/.png - they use query params or paths
    const formatted = formatForChannel("Found properties", "whatsapp", {
      extractImageFromToolOutput: {
        results: [
          { imageUrl: "https://cdn.bayut.com/thumbnails/123456-800x600.webp" },
          { imageUrl: "https://images.aqar.fm/webp/props/abc123" },
          { imageUrl: "https://cloudinary.com/image/upload/v1234/property" },
        ],
      },
    });

    expect(formatted.imageUrls).toContain("https://cdn.bayut.com/thumbnails/123456-800x600.webp");
    expect(formatted.imageUrls).toContain("https://images.aqar.fm/webp/props/abc123");
    expect(formatted.imageUrls).toContain("https://cloudinary.com/image/upload/v1234/property");
    expect(formatted.imageUrl).toBeDefined();
  });

  it("extracts imageUrl from TOON-encoded string format", () => {
    // TOON tabular format has URLs as bare values in rows
    // CDN URLs are matched by domain patterns (cdn., images., img., etc.)
    const toonOutput = `source: web_fallback
results[2]{title,description,externalUrl,imageUrl}:
Villa in Riyadh	3BR luxury villa	https://example.com/1	https://cdn.bayut.com/img/villa1
Apartment Jeddah	2BR modern apt	https://example.com/2	https://images.aqar.fm/apt2`;

    const formatted = formatForChannel("Search results", "whatsapp", {
      extractImageFromToolOutput: toonOutput,
    });

    expect(formatted.imageUrls?.length).toBeGreaterThan(0);
    expect(formatted.imageUrls).toContain("https://cdn.bayut.com/img/villa1");
    expect(formatted.imageUrls).toContain("https://images.aqar.fm/apt2");
  });

  it("extracts imageUrl from JSON string with non-extension URLs", () => {
    const jsonOutput = JSON.stringify({
      results: [
        { title: "Villa", imageUrl: "https://storage.googleapis.com/bucket/image123" },
        { title: "Apt", imageUrl: "https://res.cloudinary.com/demo/image/upload/sample" },
      ],
    });

    const formatted = formatForChannel("Results", "whatsapp", {
      extractImageFromToolOutput: jsonOutput,
    });

    expect(formatted.imageUrls).toContain("https://storage.googleapis.com/bucket/image123");
    expect(formatted.imageUrls).toContain("https://res.cloudinary.com/demo/image/upload/sample");
  });

  it("builds whatsapp offerBlocks from structured tool output with strict index pairing", () => {
    const formatted = formatForChannel("Raw summary", "whatsapp", {
      extractImageFromToolOutput: {
        source: "web_fallback",
        results: [
          {
            title: "Offer One",
            description: "First description",
            imageUrl: "https://img.example.com/one.jpg",
          },
          {
            title: "Offer Two",
            description: "Second description",
          },
          {
            title: "Offer Three",
            description: "Third description",
            imageUrl: "https://img.example.com/three.jpg",
          },
        ],
      },
    });

    expect(formatted.offerBlocks).toEqual([
      {
        text: "*1. Offer One*\n\nFirst description",
        imageUrl: "https://img.example.com/one.jpg",
      },
      {
        text: "*2. Offer Two*\n\nSecond description",
        imageUrl: undefined,
      },
      {
        text: "*3. Offer Three*\n\nThird description",
        imageUrl: "https://img.example.com/three.jpg",
      },
    ]);
  });

  it("reads offerBlocks from second tool output when first has no results", () => {
    const formatted = formatForChannel("Raw summary", "whatsapp", {
      extractImageFromToolOutput: [
        { source: "ignored", results: [] },
        {
          source: "web_fallback",
          results: [
            {
              title: "Found Offer",
              description: "From second tool output",
              imageUrl: "https://img.example.com/found.jpg",
            },
          ],
        },
      ],
    });

    expect(formatted.offerBlocks?.length).toBe(1);
    expect(formatted.offerBlocks?.[0].text).toContain("Found Offer");
    expect(formatted.offerBlocks?.[0].imageUrl).toBe(
      "https://img.example.com/found.jpg"
    );
  });

  it("never includes source links in whatsapp offerBlocks", () => {
    const formatted = formatForChannel("Raw summary", "whatsapp", {
      extractImageFromToolOutput: {
        source: "web_fallback",
        results: [
          {
            title: "Offer One",
            description: "First description",
            externalUrl: "https://example.com/property/1",
            imageUrl: "https://img.example.com/one.jpg",
          },
        ],
      },
    });

    expect(formatted.offerBlocks?.[0].text).not.toContain("https://example.com/property/1");
    expect(formatted.offerBlocks?.[0].text).not.toContain("Link:");
  });

  it("renders Arabic labels for whatsapp offers when preferredLanguage is Arabic", () => {
    const formatted = formatForChannel("Raw summary", "whatsapp", {
      preferredLanguage: "ar",
      extractImageFromToolOutput: {
        source: "web_fallback",
        results: [
          {
            title: "شقة للبيع في الرياض",
            description: "قريبة من الخدمات",
            priceHint: "900000 ريال",
            locationHint: "الرياض",
            imageUrl: "https://img.example.com/ar.jpg",
          },
        ],
      },
    });

    expect(formatted.offerBlocks?.[0].text).toContain("السعر:");
    expect(formatted.offerBlocks?.[0].text).toContain("الموقع:");
    expect(formatted.offerBlocks?.[0].text).not.toContain("Price:");
    expect(formatted.offerBlocks?.[0].text).not.toContain("Location:");
  });

  it("uses Arabic fallback title when source title is English-only", () => {
    const formatted = formatForChannel("Raw summary", "whatsapp", {
      preferredLanguage: "ar",
      extractImageFromToolOutput: {
        source: "web_fallback",
        results: [
          {
            title: "Apartment with 3 Bedrooms For Sale",
            description: "English only description",
            locationHint: "Riyadh",
            priceHint: "900000 SAR",
          },
        ],
      },
    });

    expect(formatted.offerBlocks?.[0].text).toContain("1. عرض عقاري");
    expect(formatted.offerBlocks?.[0].text).toContain("عدد الغرف: 3");
    expect(formatted.offerBlocks?.[0].text).not.toContain("English only description");
  });

  it("renders English labels for whatsapp offers when preferredLanguage is English", () => {
    const formatted = formatForChannel("Raw summary", "whatsapp", {
      preferredLanguage: "en",
      extractImageFromToolOutput: {
        source: "web_fallback",
        results: [
          {
            title: "Apartment in Riyadh",
            description: "Near services",
            priceHint: "900000 SAR",
            locationHint: "Riyadh",
            imageUrl: "https://img.example.com/en.jpg",
          },
        ],
      },
    });

    expect(formatted.offerBlocks?.[0].text).toContain("Price:");
    expect(formatted.offerBlocks?.[0].text).toContain("Location:");
    expect(formatted.offerBlocks?.[0].text).not.toContain("السعر:");
    expect(formatted.offerBlocks?.[0].text).not.toContain("الموقع:");
  });

  it("strips non-image URLs from whatsapp fallback text", () => {
    const formatted = formatForChannel(
      "See details at https://example.com/listing/42 and image https://img.example.com/one.jpg",
      "whatsapp"
    );
    expect(formatted.text).not.toContain("https://example.com/listing/42");
  });

  it("keeps per-offer multi-image gallery when tool output provides imageUrls", () => {
    const formatted = formatForChannel("Raw summary", "whatsapp", {
      extractImageFromToolOutput: {
        results: [
          {
            title: "Offer With Gallery",
            description: "Rich details",
            imageUrls: [
              "https://img.example.com/gallery-1.jpg",
              "https://img.example.com/gallery-2.jpg",
              "https://img.example.com/gallery-3.jpg",
            ],
          },
        ],
      },
    });

    expect(formatted.offerBlocks?.[0].imageUrl).toBe(
      "https://img.example.com/gallery-1.jpg"
    );
    expect(formatted.offerBlocks?.[0].imageUrls).toEqual([
      "https://img.example.com/gallery-1.jpg",
      "https://img.example.com/gallery-2.jpg",
      "https://img.example.com/gallery-3.jpg",
    ]);
  });

  it("ensures whatsapp text ends with a single next-step question", () => {
    const formatted = formatForChannel("هذه خيارات مناسبة لك", "whatsapp");
    const lines = formatted.text.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[lines.length - 1]).toMatch(/[؟?]$/);
  });
});
