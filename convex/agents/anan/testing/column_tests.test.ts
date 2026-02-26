/**
 * Unit tests for judgeColumnTest: agent response judging logic.
 * No LLM/API required - uses mock results.
 */
import { describe, expect, it } from "vitest";
import {
  COLUMN_TEST_CASES,
  judgeColumnTest,
  type ColumnTestCase,
} from "./column_tests";

describe("judgeColumnTest", () => {
  const mockResult = (
    overrides: Partial<{
      toolCalls: Array<{ name: string; args: unknown }>;
      toolResults: Array<{ name: string; result: unknown }>;
      assistantMessage: string;
      offerBlocks: Array<{ imageUrl?: string; imageUrls?: string[] }>;
    }> = {}
  ) => ({
    toolCalls: [] as Array<{ name: string; args: unknown }>,
    toolResults: [] as Array<{ name: string; result: unknown }>,
    assistantMessage: "",
    offerBlocks: [],
    ...overrides,
  });

  it("passes when requiredToolsAny is satisfied by tool result", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "A1-search-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolResults: [{ name: "smartPropertySearch", result: {} }],
        assistantMessage: "هذه أفضل النتائج الآن\n- خيار 1\n- خيار 2\nهل تريد تفاصيل أكثر؟",
        offerBlocks: [
          { imageUrls: ["https://example.com/1.jpg"] },
          { imageUrls: ["https://example.com/2.jpg"] },
        ],
      })
    );
    expect(r.pass).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("fails when requiredToolsAny is missing", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "A1-search-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolCalls: [{ name: "searchRealEstateInfo", args: {} }],
        assistantMessage: "عذراً، لم أجد نتائج",
        offerBlocks: [],
      })
    );
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes("Missing required tool family"))).toBe(
      true
    );
  });

  it("fails when minOfferBlocks not met", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "A1-search-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolResults: [{ name: "smartPropertySearch", result: {} }],
        assistantMessage: "نتائج",
        offerBlocks: [{ imageUrls: ["x.jpg"] }],
      })
    );
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes("offerBlocks.length"))).toBe(true);
  });

  it("fails when minImagesPerOffer not met", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "A1-search-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolResults: [{ name: "smartPropertySearch", result: {} }],
        assistantMessage: "نتائج البحث",
        offerBlocks: [{ imageUrls: [] }, { imageUrls: [] }],
      })
    );
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes("No offer block has"))).toBe(true);
  });

  it("fails when responseMustNotContain is violated", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "A2-another-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolResults: [{ name: "smartPropertySearch", result: {} }],
        assistantMessage: "ما الموقع الذي تريده؟",
        offerBlocks: [{ imageUrls: ["a.jpg"] }, { imageUrls: ["b.jpg"] }],
      })
    );
    expect(r.pass).toBe(false);
    expect(
      r.reasons.some((x) => x.includes("Response contains forbidden phrase"))
    ).toBe(true);
  });

  it("passes when responseMustContainAny is satisfied", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "G1-objection-price-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolResults: [{ name: "smartPropertySearch", result: {} }],
        assistantMessage: "عندي بدائل أرخص لك\n- حي قريب\n- سعر أقل\nتحب أعرض التفاصيل؟",
        offerBlocks: [],
      })
    );
    expect(r.pass).toBe(true);
  });

  it("fails when responseMustContainAny is not satisfied", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "G1-objection-price-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolResults: [{ name: "smartPropertySearch", result: {} }],
        assistantMessage: "Okay",
        offerBlocks: [],
      })
    );
    expect(r.pass).toBe(false);
    expect(
      r.reasons.some((x) => x.includes("Response must contain one of"))
    ).toBe(true);
  });

  it("fails when enforceSingleLanguage detects mixed Arabic/English", () => {
    const tc: ColumnTestCase = {
      id: "mixed-lang",
      userMessage: "شقق الرياض",
      intent: "search",
      passCriteria: {
        requiredToolsAny: ["smartPropertySearch"],
        enforceSingleLanguage: true,
        expectedLanguage: "ar",
      },
    };
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolResults: [{ name: "smartPropertySearch", result: {} }],
        assistantMessage: "هذه النتائج for apartments in Riyadh",
        offerBlocks: [],
      })
    );
    expect(r.pass).toBe(false);
    expect(
      r.reasons.some((x) => x.includes("mixes Arabic and English"))
    ).toBe(true);
  });

  it("fails when forbiddenTools is called", () => {
    const tc: ColumnTestCase = {
      id: "forbidden",
      userMessage: "hello",
      intent: "search",
      passCriteria: {
        requiredToolsAny: ["smartPropertySearch"],
        forbiddenTools: ["requestHumanHandoff"],
      },
    };
    const r = judgeColumnTest(
      tc,
      mockResult({
        toolCalls: [
          { name: "smartPropertySearch", args: {} },
          { name: "requestHumanHandoff", args: {} },
        ],
        assistantMessage: "Done",
        offerBlocks: [],
      })
    );
    expect(r.pass).toBe(false);
    expect(
      r.reasons.some((x) => x.includes("Forbidden tool was called"))
    ).toBe(true);
  });

  it("returns suggestions when pass is false", () => {
    const tc = COLUMN_TEST_CASES.find((t) => t.id === "A1-search-arabic")!;
    const r = judgeColumnTest(
      tc,
      mockResult({
        assistantMessage: "ok",
        offerBlocks: [],
      })
    );
    expect(r.pass).toBe(false);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("fails when response contract is missing next-step question", () => {
    const tc: ColumnTestCase = {
      id: "response-contract",
      userMessage: "apartments in riyadh",
      intent: "search",
      passCriteria: {
        enforceResponseContract: true,
      },
    };
    const r = judgeColumnTest(
      tc,
      mockResult({
        assistantMessage: "Here are options\n- item 1\n- item 2",
      }),
    );
    expect(r.pass).toBe(false);
    expect(
      r.reasons.some((x) =>
        x.includes("Answer -> Details -> Next Step contract"),
      ),
    ).toBe(true);
  });

  it("fails when vendor/provider name appears in output", () => {
    const tc: ColumnTestCase = {
      id: "no-vendor",
      userMessage: "search",
      intent: "search",
      passCriteria: {
        enforceNoVendorNames: true,
      },
    };
    const r = judgeColumnTest(
      tc,
      mockResult({
        assistantMessage: "I found this on Bayut and can share more.",
      }),
    );
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.includes("provider/vendor"))).toBe(true);
  });
});
