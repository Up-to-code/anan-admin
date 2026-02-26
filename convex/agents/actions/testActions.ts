import { action, internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { CHANNEL_VALIDATOR } from "./shared";
import { COLUMN_TEST_CASES, judgeColumnTest } from "../anan/testing/column_tests";
import { isAgentTestActionsEnabled } from "../runtime/env";

type GenerateReplyResult = {
  text: string;
  threadId: string;
  offerBlocks?: Array<{ imageUrl?: string; imageUrls?: string[]; text?: string }>;
  responseMode?: "search_list" | "single_property_detail" | "general_info";
};

type RunAllColumnTestsResult = {
  total: number;
  passCount: number;
  passRate: number;
  results: Array<{
    testCaseId: string;
    pass: boolean;
    reasons: string[];
    suggestions: string[];
  }>;
};

type ColumnTestResult =
  | { error: string }
  | {
      testCaseId: string;
      pass: boolean;
      reasons: string[];
      suggestions: string[];
      toolCalls: Array<{ name: string; args: unknown }>;
      assistantMessage: string;
      offerBlocksCount: number;
      threadId?: string;
    };

type ScenarioTurn = {
  message: string;
  replyText: string;
  threadId: string;
  toolCalls: string[];
  responseMode?: "search_list" | "single_property_detail" | "general_info";
  offerBlocksCount: number;
  durationMs: number;
};

type ScenarioResult = {
  scenarioId: string;
  userId: string;
  threadId: string;
  turns: ScenarioTurn[];
};

export const testAgent = action({
  args: { message: v.string(), userId: v.optional(v.string()) },
  handler: async (
    ctx,
    { message, userId = "test-user" },
  ): Promise<{ question: string; reply: string; threadId: string }> => {
    if (!isAgentTestActionsEnabled()) {
      throw new Error("Not available unless AGENT_TEST_ACTIONS is enabled");
    }
    // @ts-ignore - internal triggers TS2589 in some TS language service contexts
    const api = internal as unknown;
    const genRef = (api as { agents: { actions: { generateReplyAndReturnText: unknown } } })
      .agents.actions.generateReplyAndReturnText;
    const reply = (await (ctx.runAction as (ref: unknown, args: unknown) => Promise<unknown>)(
      genRef,
      { userId, message },
    )) as GenerateReplyResult;
    const { text, threadId } = reply;
    return { question: message, reply: text, threadId };
  },
});

export const testAgentMultiTurn = action({
  args: { userId: v.string(), messages: v.array(v.string()) },
  handler: async (ctx, { userId, messages }): Promise<{ replies: string[] }> => {
    await ctx.runMutation(internal.agents.actions.requireAdminMutation, {});
    const replies: string[] = [];
    for (const message of messages) {
      const reply = (await ctx.runAction(
        internal.agents.actions.generateReplyAndReturnText,
        { userId, message },
      )) as GenerateReplyResult;
      replies.push(reply.text);
    }
    return { replies };
  },
});

export const runColumnTest = internalAction({
  args: {
    testCaseId: v.string(),
    userId: v.string(),
    channel: v.optional(CHANNEL_VALIDATOR),
  },
  handler: async (
    ctx,
    { testCaseId, userId, channel = "app" },
  ): Promise<
    | { error: string }
    | {
      testCaseId: string;
      pass: boolean;
      reasons: string[];
      suggestions: string[];
      toolCalls: Array<{ name: string; args: unknown }>;
      assistantMessage: string;
      offerBlocksCount: number;
      threadId?: string;
    }
  > => {
    const testCase = COLUMN_TEST_CASES.find((t) => t.id === testCaseId);
    if (!testCase) return { error: `Test case not found: ${testCaseId}` };
    const replyResult = (await ctx.runAction(
      internal.agents.actions.generateReplyAndReturnText,
      { userId, message: testCase.userMessage, channel },
    )) as GenerateReplyResult;
    const trace = await ctx.runQuery(internal.agents.actions.getLatestTraceForThreadQuery, {
      threadId: replyResult.threadId,
    });
    const traceData = trace ?? {
      toolCalls: [] as Array<{ name: string; args: unknown }>,
      toolResults: [] as Array<{ name: string; result: unknown }>,
      assistantMessage: replyResult.text,
    };
    const judgeResult = judgeColumnTest(testCase, {
      toolCalls: traceData.toolCalls,
      toolResults: traceData.toolResults,
      assistantMessage: traceData.assistantMessage,
      offerBlocks: replyResult.offerBlocks,
    });
    return {
      testCaseId,
      pass: judgeResult.pass,
      reasons: trace
        ? judgeResult.reasons
        : [...judgeResult.reasons, "Trace missing: judged from response only"],
      suggestions: trace
        ? judgeResult.suggestions
        : [
          ...judgeResult.suggestions,
          "Trace logging missing for this turn; quality was judged from response content only.",
        ],
      toolCalls: traceData.toolCalls,
      assistantMessage: traceData.assistantMessage,
      offerBlocksCount: replyResult.offerBlocks?.length ?? 0,
      threadId: replyResult.threadId,
    };
  },
});

export const runAllColumnTests = internalAction({
  args: {
    userId: v.string(),
    channel: v.optional(CHANNEL_VALIDATOR),
    testCaseIds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { userId, channel = "app", testCaseIds },
  ): Promise<RunAllColumnTestsResult> => {
    const cases = testCaseIds
      ? COLUMN_TEST_CASES.filter((t) => testCaseIds.includes(t.id))
      : [...COLUMN_TEST_CASES];
    const results: RunAllColumnTestsResult["results"] = [];
    for (const tc of cases) {
      const r = (await ctx.runAction(internal.agents.actions.runColumnTest, {
        testCaseId: tc.id,
        userId,
        channel,
      })) as ColumnTestResult;
      if ("error" in r) {
        results.push({
          testCaseId: tc.id,
          pass: false,
          reasons: [r.error],
          suggestions: ["Check: test case and agent availability."],
        });
      } else {
        results.push({
          testCaseId: r.testCaseId,
          pass: r.pass,
          reasons: r.reasons,
          suggestions: r.suggestions,
        });
      }
    }
    const passCount = results.filter((r) => r.pass).length;
    return {
      total: results.length,
      passCount,
      passRate: results.length > 0 ? passCount / results.length : 0,
      results,
    };
  },
});

export const runAllColumnTestsAction = action({
  args: {
    userId: v.optional(v.string()),
    channel: v.optional(CHANNEL_VALIDATOR),
    testCaseIds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { userId, channel = "app", testCaseIds },
  ): Promise<RunAllColumnTestsResult> => {
    if (!isAgentTestActionsEnabled()) {
      throw new Error("Not available unless AGENT_TEST_ACTIONS is enabled");
    }
    return (await ctx.runAction(internal.agents.actions.runAllColumnTests, {
      userId: userId ?? `test-column-${Date.now()}`,
      channel,
      testCaseIds,
    })) as RunAllColumnTestsResult;
  },
});

export const runScenarioConversationAction = action({
  args: {
    scenarioId: v.string(),
    userId: v.optional(v.string()),
    channel: v.optional(CHANNEL_VALIDATOR),
    messages: v.array(v.string()),
  },
  handler: async (
    ctx,
    { scenarioId, userId, channel = "whatsapp", messages },
  ): Promise<ScenarioResult> => {
    if (!isAgentTestActionsEnabled()) {
      throw new Error("Not available unless AGENT_TEST_ACTIONS is enabled");
    }
    const resolvedUserId = userId ?? `test-scenario-${scenarioId}-${Date.now()}`;
    const turns: ScenarioTurn[] = [];
    let lastThreadId = "";

    for (const message of messages) {
      const startedAt = Date.now();
      const reply = (await ctx.runAction(internal.agents.actions.generateReplyAndReturnText, {
        userId: resolvedUserId,
        message,
        channel,
      })) as GenerateReplyResult;
      const durationMs = Date.now() - startedAt;
      const trace = await ctx.runQuery(internal.agents.actions.getLatestTraceForThreadQuery, {
        threadId: reply.threadId,
      });
      turns.push({
        message,
        replyText: reply.text,
        threadId: reply.threadId,
        toolCalls: (trace?.toolCalls ?? []).map((call) => call.name),
        responseMode: reply.responseMode,
        offerBlocksCount: reply.offerBlocks?.length ?? 0,
        durationMs,
      });
      lastThreadId = reply.threadId;
    }

    return {
      scenarioId,
      userId: resolvedUserId,
      threadId: lastThreadId,
      turns,
    };
  },
});
