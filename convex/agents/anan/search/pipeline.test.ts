import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildFindings } from "./pipeline";
import type { SerperResult } from "./types";

const extractCardsFromSourceMock = vi.fn();
const extractPropertyDetailsMock = vi.fn();

vi.mock("./stagehand", () => ({
  extractCardsFromSource: (...args: unknown[]) =>
    extractCardsFromSourceMock(...args),
  extractPropertyDetails: (...args: unknown[]) =>
    extractPropertyDetailsMock(...args),
}));

describe("buildFindings", () => {
  beforeEach(() => {
    extractCardsFromSourceMock.mockReset();
    extractPropertyDetailsMock.mockReset();
  });

  it("deep-enriches only top 3 candidates and keeps provenance", async () => {
    const sources: SerperResult[] = [
      {
        title: "Source One",
        description: "s1",
        externalUrl: "https://example.com/source-1",
      },
      {
        title: "Source Two",
        description: "s2",
        externalUrl: "https://example.com/source-2",
      },
    ];

    extractCardsFromSourceMock
      .mockResolvedValueOnce([
        {
          rank: 1,
          title: "A",
          url: "https://example.com/p/a",
          snippet: "A snippet",
          imageUrl: "https://img.example.com/a.jpg",
        },
        {
          rank: 2,
          title: "B",
          url: "https://example.com/p/b",
          snippet: "B snippet",
          imageUrl: "https://img.example.com/b.jpg",
        },
        {
          rank: 3,
          title: "C",
          url: "https://example.com/p/c",
          snippet: "C snippet",
          imageUrl: "https://img.example.com/c.jpg",
        },
      ])
      .mockResolvedValueOnce([
        {
          rank: 1,
          title: "D",
          url: "https://example.com/p/d",
          snippet: "D snippet",
          imageUrl: "https://img.example.com/d.jpg",
        },
        {
          rank: 2,
          title: "E",
          url: "https://example.com/p/e",
          snippet: "E snippet",
          imageUrl: "https://img.example.com/e.jpg",
        },
        {
          rank: 3,
          title: "F",
          url: "https://example.com/p/f",
          snippet: "F snippet",
          imageUrl: "https://img.example.com/f.jpg",
        },
      ]);

    extractPropertyDetailsMock.mockImplementation(async (_ctx, url: string) => ({
      title: `Detailed ${url.split("/").pop()}`,
      description: "Detailed description",
      price: "1000000 SAR",
      location: "Riyadh",
      imageUrls: [`https://img.example.com/detail-${url.split("/").pop()}.jpg`],
    }));

    const findings = await buildFindings({} as any, sources, [], {
      maxFindings: 6,
      detailEnrichCount: 3,
    });

    expect(extractPropertyDetailsMock).toHaveBeenCalledTimes(3);
    expect(findings).toHaveLength(6);
    expect(findings.filter((f) => f.detailFetched)).toHaveLength(3);
    expect(findings.every((f) => typeof f.sourceUrl === "string")).toBe(true);
    expect(findings.every((f) => typeof f.sourceTitle === "string")).toBe(true);
  });

  it("excludes previously shown property URLs", async () => {
    const sources: SerperResult[] = [
      {
        title: "Source One",
        description: "s1",
        externalUrl: "https://example.com/source-1",
      },
    ];

    extractCardsFromSourceMock.mockResolvedValueOnce([
      {
        rank: 1,
        title: "Old",
        url: "https://example.com/p/old/",
        snippet: "old",
      },
      {
        rank: 2,
        title: "New",
        url: "https://example.com/p/new",
        snippet: "new",
      },
    ]);

    extractPropertyDetailsMock.mockImplementation(async (_ctx, url: string) => ({
      title: `Detailed ${url.split("/").pop()}`,
      description: "Detailed description",
      imageUrls: [],
    }));

    const findings = await buildFindings({} as any, sources, [], {
      maxFindings: 5,
      detailEnrichCount: 3,
      excludePropertyUrls: new Set(["https://example.com/p/old"]),
    });

    expect(findings.some((f) => f.propertyUrl?.includes("/old"))).toBe(false);
    expect(findings.some((f) => f.propertyUrl?.includes("/new"))).toBe(true);
  });
});
