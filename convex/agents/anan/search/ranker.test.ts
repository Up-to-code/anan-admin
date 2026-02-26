import { describe, expect, it } from "vitest";
import { mergeAndRankFindings } from "./ranker";

describe("ranker", () => {
  it("deduplicates by property URL", () => {
    const merged = mergeAndRankFindings(
      [
        {
          sourceRank: 1,
          sourceUrl: "https://source-a",
          cardRank: 1,
          propertyUrl: "https://example.com/p/1",
          title: "A",
          imageUrls: [],
        },
      ],
      [
        {
          sourceRank: 2,
          sourceUrl: "https://source-b",
          cardRank: 1,
          propertyUrl: "https://example.com/p/1/",
          title: "A duplicate",
          imageUrls: ["https://img.example.com/1.jpg"],
        },
      ],
    );
    expect(merged).toHaveLength(1);
  });

  it("ranks richer findings higher", () => {
    const merged = mergeAndRankFindings(
      [],
      [
        {
          sourceRank: 1,
          sourceUrl: "https://source-a",
          cardRank: 1,
          propertyUrl: "https://example.com/p/1",
          title: "Richer",
          imageUrls: ["https://img.example.com/1.jpg"],
          priceHint: "1000000 SAR",
          locationHint: "Riyadh",
          confidence: 0.7,
        },
        {
          sourceRank: 1,
          sourceUrl: "https://source-a",
          cardRank: 2,
          propertyUrl: "https://example.com/p/2",
          title: "Thin",
          imageUrls: [],
          confidence: 0.4,
        },
      ],
    );
    expect(merged[0]?.title).toBe("Richer");
  });
});
