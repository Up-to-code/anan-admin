import { describe, expect, it } from "vitest";
import { tokenizeQuery, dbResultMatchScore } from "./propertyCache";
import type { DbPropertyResult } from "../../_lib/types";

describe("tokenizeQuery", () => {
  it("preserves numbers", () => {
    const { tokens } = tokenizeQuery("apartment 2 beds 1500000");
    expect(tokens).toContain("2");
    expect(tokens).toContain("1500000");
  });

  it("removes stopwords", () => {
    const { tokens } = tokenizeQuery("find property in Riyadh");
    expect(tokens).not.toContain("find");
    expect(tokens).not.toContain("in");
    expect(tokens).not.toContain("property");
    expect(tokens).toContain("riyadh");
  });

  it("extracts location phrases", () => {
    const { locationPhrases } = tokenizeQuery("properties in Riyadh");
    expect(locationPhrases).toContain("riyadh");
  });
});

describe("dbResultMatchScore", () => {
  it("weights title match higher than description", () => {
    const result: DbPropertyResult = {
      title: "Villa in Riyadh",
      description: "Nice apartment in Jeddah",
      location: "Jeddah",
    };
    const titleScore = dbResultMatchScore(["riyadh"], [], result);
    const descScore = dbResultMatchScore(["apartment"], [], result);
    expect(titleScore).toBeGreaterThan(descScore);
  });

  it("applies phrase bonus for location", () => {
    const result: DbPropertyResult = {
      title: "Villa",
      location: "Riyadh Al Malqa",
      description: "Spacious villa",
    };
    const withPhrase = dbResultMatchScore(["villa"], ["riyadh"], result);
    const withoutPhrase = dbResultMatchScore(["villa"], [], result);
    expect(withPhrase).toBeGreaterThanOrEqual(withoutPhrase);
  });
});
