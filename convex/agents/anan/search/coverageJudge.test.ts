import { describe, expect, it } from "vitest";
import { evaluateCoverage } from "./coverageJudge";

describe("coverageJudge", () => {
  it("asks for second pass when coverage is weak", () => {
    const previous = process.env.SEARCH_ORCH_SECOND_PASS_ENABLED;
    process.env.SEARCH_ORCH_SECOND_PASS_ENABLED = "true";
    const report = evaluateCoverage({
      plan: {
        intent: "property_search",
        scope: "saudi",
        profile: "balanced",
        taskList: [],
        searchTerms: [],
        primaryQuery: "apartments in riyadh",
        queryVariants: [],
        limit: 5,
        offset: 0,
        deadlineMs: Date.now() + 10_000,
      },
      findings: [],
      sources: [],
    });
    if (previous === undefined) {
      delete process.env.SEARCH_ORCH_SECOND_PASS_ENABLED;
    } else {
      process.env.SEARCH_ORCH_SECOND_PASS_ENABLED = previous;
    }
    expect(report.shouldRunSecondPass).toBe(true);
  });

  it("marks sufficient coverage for rich results", () => {
    const report = evaluateCoverage({
      plan: {
        intent: "property_search",
        scope: "saudi",
        profile: "balanced",
        taskList: [],
        searchTerms: [],
        primaryQuery: "apartments in riyadh",
        queryVariants: [],
        limit: 3,
        offset: 0,
        deadlineMs: Date.now() + 10_000,
      },
      findings: [
        {
          sourceRank: 1,
          sourceUrl: "a",
          cardRank: 1,
          title: "A",
          imageUrls: ["img"],
          detailFetched: true,
        },
        {
          sourceRank: 2,
          sourceUrl: "b",
          cardRank: 1,
          title: "B",
          imageUrls: ["img2"],
          detailFetched: true,
        },
        {
          sourceRank: 3,
          sourceUrl: "c",
          cardRank: 1,
          title: "C",
          imageUrls: ["img3"],
          detailFetched: true,
        },
      ],
      sources: [
        { title: "a", description: "", externalUrl: "https://a" },
        { title: "b", description: "", externalUrl: "https://b" },
        { title: "c", description: "", externalUrl: "https://c" },
      ],
    });
    expect(report.shouldRunSecondPass).toBe(false);
    expect(report.score).toBeGreaterThan(0.7);
  });
});
