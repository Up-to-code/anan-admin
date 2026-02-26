/**
 * Unit tests for agent reply scoring (scoreReply, scoreFlow).
 */
import { describe, expect, it } from "vitest";
import { scoreFlow, scoreReply } from "./agentScoring";

describe("scoreReply", () => {
  const ctx = {
    messageIndex: 0,
    userMessage: "Show me apartments in Riyadh",
    totalMessages: 1,
  };

  it("scores high when keywords match", () => {
    const score = scoreReply(
      "Here are apartments in Riyadh that match your search.",
      ["apartment", "Riyadh"],
      ctx
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("scores low when no keywords match and some expected", () => {
    const score = scoreReply(
      "Nope?",
      ["apartment", "Riyadh", "price"],
      ctx
    );
    expect(score).toBeLessThan(60);
  });

  it("gives full keyword score when no keywords expected", () => {
    const score = scoreReply(
      "Here is some helpful information about properties.",
      [],
      ctx
    );
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it("penalizes very short replies", () => {
    const short = scoreReply("Yes", ["yes"], ctx);
    const long = scoreReply("Yes, here are the apartments you asked for.", ["yes"], ctx);
    expect(short).toBeLessThan(long);
  });

  it("penalizes agent ending with ? when user made clear request", () => {
    const question = scoreReply("What location do you prefer?", [], ctx);
    const answer = scoreReply("Here are apartments in Riyadh.", [], ctx);
    expect(question).toBeLessThan(answer);
  });

  it("rewards flow coherence in later messages", () => {
    const first = scoreReply("Here are properties.", [], {
      messageIndex: 0,
      userMessage: "Show me apartments",
      totalMessages: 2,
    });
    const secondWithContext = scoreReply("The property I discussed has 3 beds.", [], {
      messageIndex: 1,
      userMessage: "More details",
      totalMessages: 2,
    });
    const secondWithoutContext = scoreReply("Okay.", [], {
      messageIndex: 1,
      userMessage: "More details",
      totalMessages: 2,
    });
    expect(secondWithContext).toBeGreaterThan(secondWithoutContext);
  });
});

describe("scoreFlow", () => {
  it("averages per-reply scores and passes above threshold", () => {
    const flow = {
      name: "search-flow",
      messages: ["Apartments Riyadh", "More options"],
      expectedKeywordsPerReply: [["apartment", "Riyadh"], ["more", "option"]],
    };
    const replies = [
      "Here are apartments in Riyadh for you.",
      "Here are more options for you.",
    ];
    const result = scoreFlow(replies, flow, 60);
    expect(result.totalScore).toBeGreaterThanOrEqual(60);
    expect(result.passed).toBe(true);
    expect(result.perReplyScores).toHaveLength(2);
  });

  it("fails when average below threshold", () => {
    const flow = {
      name: "bad-flow",
      messages: ["Apartments Riyadh"],
      expectedKeywordsPerReply: [["apartment", "Riyadh", "price", "location"]],
    };
    const replies = ["Nope."];
    const result = scoreFlow(replies, flow, 60);
    expect(result.passed).toBe(false);
    expect(result.totalScore).toBeLessThan(60);
  });

  it("handles empty replies", () => {
    const flow = {
      name: "empty",
      messages: [],
      expectedKeywordsPerReply: [],
    };
    const result = scoreFlow([], flow);
    expect(result.totalScore).toBe(0);
    expect(result.perReplyScores).toHaveLength(0);
    expect(result.passed).toBe(false);
  });

  it("uses custom threshold", () => {
    const flow = {
      name: "custom",
      messages: ["test"],
      expectedKeywordsPerReply: [["test"]],
    };
    const replies = ["This is a test reply with the expected keyword."];
    const resultLow = scoreFlow(replies, flow, 90);
    const resultHigh = scoreFlow(replies, flow, 40);
    expect(resultLow.passed).toBe(resultLow.totalScore >= 90);
    expect(resultHigh.passed).toBe(true);
  });
});
