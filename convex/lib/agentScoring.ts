/**
 * Agent reply scoring for integration tests.
 * Rule-based scoring (no LLM calls) to evaluate agent quality.
 */

export interface ScoreReplyContext {
  messageIndex: number;
  userMessage: string;
  totalMessages: number;
}

/** Patterns that indicate user made a clear request (agent should not end with ?) */
const CLEAR_REQUEST_PATTERNS = [
  /show me\s/i,
  /list\s/i,
  /tell me\s/i,
  /what (loan|bank|property)/i,
  /recommend/i,
  /وريني|أرني|اعرض/i,
  /اعرض لي|وريني/i,
];

function isClarifyingRequest(userMessage: string): boolean {
  return CLEAR_REQUEST_PATTERNS.some((p) => p.test(userMessage));
}

/**
 * Score a single reply (0–100).
 * Dimensions: keyword relevance 40%, length 15%, no unnecessary questions 25%, flow coherence 20%.
 */
export function scoreReply(
  reply: string,
  expectedKeywords: string[],
  context: ScoreReplyContext
): number {
  const lower = reply.toLowerCase().trim();

  // 1. Keyword relevance (40%): at least one expected keyword present
  const matched = expectedKeywords.filter((k) => lower.includes(k.toLowerCase()));
  const keywordScore = expectedKeywords.length > 0
    ? (matched.length / expectedKeywords.length) * 40
    : 40;

  // 2. Answer length (15%): not too short (< 15 chars = 0), reasonable (15–500 = full), very long = partial
  let lengthScore = 15;
  if (reply.length < 15) lengthScore = 0;
  else if (reply.length > 1500) lengthScore = 10;

  // 3. No unnecessary questions (25%): penalty if user made clear request but agent ends with ?
  let questionScore = 25;
  if (isClarifyingRequest(context.userMessage) && reply.trim().endsWith("?")) {
    questionScore = 10; // Penalty: agent asked instead of answering
  }

  // 4. Flow coherence (20%): later messages reference context words
  let coherenceScore = 20;
  if (context.messageIndex > 0 && context.totalMessages > 1) {
    const contextWords = ["property", "loan", "bank", "discussed", "recommend", "عقار", "قرض", "بنك"];
    const hasContextRef = contextWords.some((w) => lower.includes(w));
    coherenceScore = hasContextRef ? 20 : 12;
  }

  return Math.round(keywordScore + lengthScore + questionScore + coherenceScore);
}

export interface FlowScoreInput {
  name: string;
  messages: string[];
  expectedKeywordsPerReply: string[][];
}

export interface FlowScoreResult {
  totalScore: number;
  perReplyScores: number[];
  passed: boolean;
  threshold?: number;
}

/**
 * Score an entire flow. Returns total (average of per-reply) and per-reply scores.
 */
export function scoreFlow(
  replies: string[],
  flow: FlowScoreInput,
  threshold: number = 60
): FlowScoreResult {
  const perReplyScores: number[] = [];

  for (let i = 0; i < replies.length; i++) {
    const expected = flow.expectedKeywordsPerReply[i] ?? [];
    const score = scoreReply(replies[i], expected, {
      messageIndex: i,
      userMessage: flow.messages[i] ?? "",
      totalMessages: flow.messages.length,
    });
    perReplyScores.push(score);
  }

  const totalScore =
    perReplyScores.length > 0
      ? Math.round(
          perReplyScores.reduce((a, b) => a + b, 0) / perReplyScores.length
        )
      : 0;

  return {
    totalScore,
    perReplyScores,
    passed: totalScore >= threshold,
    threshold,
  };
}
