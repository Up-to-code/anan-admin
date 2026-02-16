/**
 * Agent actions - thread/chat CRUD, generate response, generateReplyAndReturnText.
 * Migrated from features/agent/actions.
 */
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { components } from "../_generated/api";
import { api } from "../_generated/api";
import { buildAgentInstructions } from "./anan/instructions";
import { createRealEstateAgent } from "../features/agent/factory";
import { formatForChannel, type OfferBlock } from "../channels/formatters";
import { authComponent } from "../auth";
import { optionalAuth, requireAdmin } from "../lib/auth";
import {
  detectPreferredLanguage,
  isLikelyLanguageMismatch,
  languageGuardFallback,
} from "../lib/language";
import { debugLog, withDebugTiming } from "./debug";
import { runOfferFormatterAgent } from "./anan/files/offerFormatter";
import { extractTraceFromSteps } from "./anan/testing/traceLogger";
import {
  COLUMN_TEST_CASES,
  judgeColumnTest,
} from "./anan/testing/column_tests";

const realEstateAgent = createRealEstateAgent({
  properties: {
    search: api.services.properties.search,
    getRecentSearchCount: internal.services.properties.getRecentSearchCountInternal,
    logSearchEvent: api.services.properties.logSearchEvent,
    logKnowledgeResearch: api.services.properties.logKnowledgeResearch,
    getLastSearchContext: api.services.properties.getLastSearchContext,
    getLastSearchFindings: api.services.properties.getLastSearchFindings,
    getCachedSearchResults: api.services.properties.getCachedSearchResults,
  },
  banks: {
    getById: api.services.banks.getById,
    getBySlug: api.services.banks.getBySlug,
    getBundles: api.services.banks.getBundles,
  },
  partners: { list: api.services.partners.list },
  userProfiles: {
    getByUserId: internal.services.users.getByUserIdInternal,
    getRecentMessageCount: internal.services.users.getRecentMessageCountInternal,
    upsert: internal.services.users.upsertInternal,
  },
  knowledgePages: {
    getBySlug: api.services.content.getBySlug,
    list: api.services.content.list,
  },
  handoffs: { create: internal.services.content.createHandoffInternal },
  orders: { createDraftFromAgent: api.admin.orders.createDraftOrderFromAgent },
});

const THREAD_TTL_MS = 1000 * 60 * 60 * 24 * 30;

async function logMessageSentActivity(
  ctx: {
    runMutation: Function;
  },
  params: {
    userId?: string;
    channel?: "whatsapp" | "app" | "web";
    threadId: string;
  },
): Promise<void> {
  if (!params.userId) return;
  try {
    await ctx.runMutation(internal.services.users.logActivityInternal, {
      userId: params.userId,
      action: "message_sent",
      channel: params.channel,
      metadata: { threadId: params.threadId },
    });
  } catch (error) {
    console.error("logMessageSentActivity error:", error);
  }
}

/** Internal: assert current identity is admin. Used by actions that need admin check. */
export const requireAdminMutation = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

export const logAgentTrace = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.optional(v.string()),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    userMessage: v.string(),
    toolCalls: v.array(v.object({ name: v.string(), args: v.any() })),
    toolResults: v.array(v.object({ name: v.string(), result: v.any() })),
    assistantMessage: v.string(),
    searchTrace: v.optional(
      v.object({
        query: v.optional(v.string()),
        offset: v.optional(v.number()),
        sourceUrls: v.optional(v.array(v.string())),
        cardUrls: v.optional(v.array(v.string())),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("agentTraces", args);
    return null;
  },
});

export const touchThreadMetadata = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, userId }) => {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const thread = await ctx.runQuery(components.agent.threads.getThread, {
        threadId,
      });
      resolvedUserId = thread?.userId ?? undefined;
    }
    if (!resolvedUserId) return null;
    const now = Date.now();
    const expiresAt = now + THREAD_TTL_MS;
    const existing = await ctx.db
      .query("threadMetadata")
      .withIndex("threadId", (q) => q.eq("threadId", threadId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: resolvedUserId,
        lastActivityAt: now,
        expiresAt,
      });
      return null;
    }
    await ctx.db.insert("threadMetadata", {
      threadId,
      userId: resolvedUserId,
      lastActivityAt: now,
      expiresAt,
    });
    return null;
  },
});

export const archiveExpiredThreads = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ archivedCount: v.number() }),
  handler: async (ctx, { limit = 100 }) => {
    const now = Date.now();
    const allMetadata = await ctx.db.query("threadMetadata").collect();
    const candidates = allMetadata
      .filter(
        (item) =>
          !item.archivedAt &&
          typeof item.expiresAt === "number" &&
          item.expiresAt <= now,
      )
      .slice(0, limit);
    let archivedCount = 0;
    for (const item of candidates) {
      try {
        await ctx.runMutation(
          components.agent.threads.deleteAllForThreadIdAsync,
          {
            threadId: item.threadId,
          },
        );
      } catch (error) {
        console.error("archiveExpiredThreads delete thread error:", error);
      }
      await ctx.db.patch(item._id, { archivedAt: now });
      archivedCount += 1;
    }
    return { archivedCount };
  },
});

export const createThreadAction = mutation({
  args: {
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { userId: providedUserId, title }) => {
    let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null =
      null;
    try {
      authUser = await authComponent.getAuthUser(ctx);
    } catch {
      authUser = null;
    }

    let userId: string;
    if (authUser) {
      const authUserId =
        authUser.userId && authUser.userId !== null
          ? authUser.userId
          : String(authUser._id);
      userId = authUserId;
      if (providedUserId && providedUserId !== authUserId) {
        throw new Error(
          "User ID mismatch: provided userId does not match authenticated user",
        );
      }
    } else {
      userId = providedUserId ?? `anon-${crypto.randomUUID()}`;
    }

    const threadId = await createThread(ctx, components.agent, {
      userId,
      title,
    });
    await ctx.runMutation(internal.agents.actions.touchThreadMetadata, {
      threadId,
      userId,
    });
    return { threadId };
  },
});

export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    body: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
  },
  handler: async (ctx, { threadId, body, channel }) => {
    debugLog("actions.sendMessage", "start", {
      threadId,
      channel,
      bodyLength: body.length,
    });
    try {
      await authComponent.getAuthUser(ctx);
    } catch {
      // Allow anonymous
    }
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: body,
    });
    debugLog("actions.sendMessage", "saved_message", { threadId, messageId });
    await ctx.scheduler.runAfter(
      0,
      internal.agents.workflows.startGenerateResponseWorkflow,
      {
        threadId,
        promptMessageId: messageId,
        channel,
      },
    );
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId,
    });
    await ctx.runMutation(internal.agents.actions.touchThreadMetadata, {
      threadId,
      userId: thread?.userId ?? undefined,
    });
    await logMessageSentActivity(ctx, {
      userId: thread?.userId ?? undefined,
      channel,
      threadId,
    });
    debugLog("actions.sendMessage", "done", {
      threadId,
      scheduled: true,
      hasUserId: Boolean(thread?.userId),
    });
  },
});

export const generateResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
  },
  handler: async (ctx, { threadId, promptMessageId, channel }) => {
    debugLog("actions.generateResponse", "start", {
      threadId,
      promptMessageId,
      channel,
    });
    try {
      const thread = await ctx.runQuery(components.agent.threads.getThread, {
        threadId,
      });
      const userId = thread?.userId ?? undefined;
      const instructions = await withDebugTiming(
        "actions.generateResponse",
        "load_instructions",
        { threadId, channel },
        async () => {
          const baseInstructions = buildAgentInstructions(channel);
          const mergedInstructions = await ctx.runQuery(
            api.services.content.getMergedInstructions,
            {},
          );
          return mergedInstructions
            ? `${baseInstructions}\n\n${mergedInstructions}`
            : baseInstructions;
        },
      );
      await withDebugTiming(
        "actions.generateResponse",
        "stream_text",
        { threadId, promptMessageId, channel, hasUserId: Boolean(userId) },
        async () =>
          realEstateAgent.streamText(
            ctx,
            { threadId, userId, channel } as any,
            { promptMessageId, system: instructions } as any,
            { saveStreamDeltas: true },
          ),
      );
      debugLog("actions.generateResponse", "done", {
        threadId,
        promptMessageId,
        channel,
      });
    } catch (err) {
      console.error("generateResponse error:", err);
      debugLog("actions.generateResponse", "error", {
        threadId,
        promptMessageId,
        channel,
        error: err instanceof Error ? err.message : "unknown_error",
      });
      throw err;
    }
  },
});

const AGENT_FALLBACK_MESSAGE =
  "I'm sorry, I ran into an issue. Please try again or rephrase your question.";

export const generateReplyAndReturnText = internalAction({
  args: {
    userId: v.string(),
    message: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
  },
  handler: async (
    ctx,
    { userId, message, channel: channelArg },
  ): Promise<{
    text: string;
    imageUrl?: string;
    imageUrls?: string[];
    offerBlocks?: OfferBlock[];
    threadId: string;
  }> => {
    debugLog("actions.generateReplyAndReturnText", "start", {
      userId,
      channel: channelArg ?? "app",
      messageLength: message.length,
    });
    try {
      const threads = await ctx.runQuery(api.agents.actions.listThreads, {
        userId,
        paginationOpts: { numItems: 1, cursor: null },
      });
      let threadId: string;
      if (threads.page.length > 0) {
        threadId = threads.page[0]._id;
      } else {
        const res = await ctx.runMutation(
          api.agents.actions.createThreadAction,
          {
            userId,
          },
        );
        threadId = res.threadId;
      }

      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        userId,
        prompt: message,
      });
      await ctx.runMutation(internal.agents.actions.touchThreadMetadata, {
        threadId,
        userId,
      });
      await logMessageSentActivity(ctx, {
        userId,
        channel: channelArg,
        threadId,
      });

      const memoryContext = userId
        ? await ctx.runQuery(internal.services.memory.getRelevantContextInternal, {
            userId,
            query: message,
          })
        : null;

      const memorySummary = memoryContext?.summary ?? "";
      const memoryPreferences = (memoryContext?.preferences ?? [])
        .map((p: { key: string; value: string }) => `${p.key}: ${p.value}`)
        .join(", ");
      const memoryConstraints = (memoryContext?.constraints ?? [])
        .map((c: { key: string; value: string }) => `${c.key}: ${c.value}`)
        .join(", ");

      const memoryInjection = memoryContext
        ? `
**REMEMBERED USER CONTEXT (DO NOT RE-ASK)**:
${memorySummary}
${memoryPreferences ? `Preferences: ${memoryPreferences}` : ""}
${memoryConstraints ? `Constraints: ${memoryConstraints}` : ""}
IMPORTANT: Use this context. Do NOT ask for information already in memory. If user says "show me properties" without specifying location/budget, check memory first.
`
        : "";

      const instructions: string = (() => {
        const baseInstructions = buildAgentInstructions(channelArg ?? "app");
        return baseInstructions + memoryInjection;
      })();
      const mergedInstructions: string | null = await ctx.runQuery(
        api.services.content.getMergedInstructions,
        {},
      );
      const finalInstructions = mergedInstructions
        ? `${instructions}\n\n${mergedInstructions}`
        : instructions;
      const channel = channelArg ?? "app";
      const result = await withDebugTiming(
        "actions.generateReplyAndReturnText",
        "generate_text",
        { threadId, userId, channel },
        async () =>
          realEstateAgent.generateText(
            ctx,
            { threadId, userId, channel } as any,
            { promptMessageId: messageId, system: finalInstructions } as any,
          ),
      );
      const text = result.text;
      const steps = (result as { steps?: unknown[] }).steps;
      const { toolCalls, toolResults } = extractTraceFromSteps(steps);
      const isFollowUpRefresh = toolCalls.some(
        (call) =>
          call.name === "smartPropertySearch" &&
          typeof call.args === "object" &&
          call.args !== null &&
          (call.args as Record<string, unknown>).refreshToken === "more",
      );
      const usedSearchContext = toolCalls.some(
        (call) => call.name === "getLastSearchContext",
      );

      const toolOutputsForImage: unknown[] = [];
      if (result.steps) {
        for (const step of result.steps) {
          const toolResults = (
            step as { toolResults?: Array<{ output?: unknown }> }
          ).toolResults;
          if (toolResults) {
            for (const tr of toolResults) {
              const output = (tr as { output?: unknown }).output ?? tr;
              if (output) {
                toolOutputsForImage.push(output);
              }
            }
          }
        }
      }

      const formatted = formatForChannel(text, channel, {
        extractImageFromToolOutput:
          toolOutputsForImage.length > 0 ? toolOutputsForImage : undefined,
        preferredLanguage: detectPreferredLanguage(message),
        detailedOffers: channel === "whatsapp",
      });
      const preferredLanguage = detectPreferredLanguage(message);
      const offerFormatted =
        channel === "whatsapp" && (formatted.offerBlocks?.length ?? 0) > 0
          ? runOfferFormatterAgent({
              offerBlocks: formatted.offerBlocks ?? [],
              preferredLanguage,
              query: message,
              maxImagesPerOffer: 5,
            })
          : undefined;
      const finalOfferBlocks =
        offerFormatted?.offerBlocks ?? formatted.offerBlocks;
      let guardedText = isLikelyLanguageMismatch(
        formatted.text,
        preferredLanguage,
      )
        ? languageGuardFallback(preferredLanguage)
        : formatted.text;
      if (channel === "whatsapp" && (finalOfferBlocks?.length ?? 0) > 0) {
        guardedText = offerFormatted?.leadText
          ? offerFormatted.leadText
          : preferredLanguage === "ar"
            ? isFollowUpRefresh || usedSearchContext
              ? "أبشر، هذه خيارات إضافية حسب طلبك. شوف الصور والتفاصيل واختار الأنسب:"
              : "أبشر، لقيت لك خيارات مناسبة ومفصلة. شوف العروض والصور واختر الأنسب لك:"
            : isFollowUpRefresh || usedSearchContext
              ? "Great, here are additional options based on your last search. Check the offers and images below:"
              : "I got this for you with specific matching options and details. Check the offers and images below:";
      }
      debugLog("actions.generateReplyAndReturnText", "done", {
        threadId,
        channel,
        preferredLanguage,
        languageGuardApplied: guardedText !== formatted.text,
        hasImage: Boolean(formatted.imageUrl),
        imageCount: formatted.imageUrls?.length ?? 0,
        offerBlockCount: formatted.offerBlocks?.length ?? 0,
        textLength: guardedText.length,
      });

      if (toolCalls.length > 0 || toolResults.length > 0) {
        try {
          await ctx.runMutation(internal.agents.actions.logAgentTrace, {
            threadId,
            userId,
            channel,
            userMessage: message,
            toolCalls,
            toolResults,
            assistantMessage: guardedText,
          });
        } catch (err) {
          console.warn("[generateReplyAndReturnText] trace log failed", err);
        }
      }

      return {
        text: guardedText,
        imageUrl: formatted.imageUrl ?? formatted.imageUrls?.[0],
        imageUrls: formatted.imageUrls,
        offerBlocks: finalOfferBlocks,
        threadId,
      };
    } catch (err) {
      console.error("generateReplyAndReturnText error:", err);
      debugLog("actions.generateReplyAndReturnText", "error", {
        userId,
        channel: channelArg ?? "app",
        error: err instanceof Error ? err.message : "unknown_error",
      });
      return { text: AGENT_FALLBACK_MESSAGE, threadId: "" };
    }
  },
});

export const getThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
    allowAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread) throw new Error("Thread not found");

    let currentUserId: string | null = null;
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      currentUserId =
        authUser?.userId ?? (authUser?._id ? String(authUser._id) : null);
    } catch {}

    if (args.allowAdmin) {
      await requireAdmin(ctx);
    } else if (
      thread.userId &&
      currentUserId &&
      thread.userId !== currentUserId
    ) {
      throw new Error("Access denied: you can only view your own threads");
    }

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });
    return { ...paginated, streams };
  },
});

export const testAgent = action({
  args: { message: v.string(), userId: v.optional(v.string()) },
  handler: async (
    ctx,
    { message, userId = "test-user" },
  ): Promise<{ question: string; reply: string; threadId: string }> => {
    await ctx.runMutation(internal.agents.actions.requireAdminMutation, {});
    const { text, threadId } = await ctx.runAction(
      internal.agents.actions.generateReplyAndReturnText,
      { userId, message },
    );
    return { question: message, reply: text, threadId };
  },
});

export const testAgentMultiTurn = action({
  args: { userId: v.string(), messages: v.array(v.string()) },
  handler: async (
    ctx,
    { userId, messages },
  ): Promise<{ replies: string[] }> => {
    await ctx.runMutation(internal.agents.actions.requireAdminMutation, {});
    const replies: string[] = [];
    for (const message of messages) {
      const { text } = await ctx.runAction(
        internal.agents.actions.generateReplyAndReturnText,
        { userId, message },
      );
      replies.push(text);
    }
    return { replies };
  },
});

export const listThreads = query({
  args: {
    userId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { userId: _clientUserId, paginationOpts }) => {
    const authUserId = await optionalAuth(ctx);
    const userId = authUserId ?? undefined;
    return ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId,
      paginationOpts,
    });
  },
});

export const searchThreads = query({
  args: {
    userId: v.optional(v.string()),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId: _clientUserId, query: searchQuery, limit = 50 }) => {
    const authUserId = await optionalAuth(ctx);
    const userId = authUserId ?? undefined;
    return ctx.runQuery(components.agent.threads.searchThreadTitles, {
      userId,
      query: searchQuery,
      limit,
    });
  },
});

export const deleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const userId =
      authUser.userId && authUser.userId !== null
        ? authUser.userId
        : String(authUser._id);

    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId,
        paginationOpts: { numItems: 100, cursor: null },
      },
    );
    const ownsThread = threads.page.some(
      (t: { _id: string }) => t._id === threadId,
    );
    if (!ownsThread) throw new Error("Thread not found or access denied");

    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId,
    });
    return { success: true };
  },
});

export const listUsersWithThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.runQuery(components.agent.users.listUsersWithThreads, {
      paginationOpts,
    });
  },
});

/** Internal: get latest agent trace for a thread (for column test runner). */
export const getLatestTraceForThreadQuery = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const traces = await ctx.db
      .query("agentTraces")
      .withIndex("threadId", (q) => q.eq("threadId", threadId))
      .order("desc")
      .take(1);
    return traces[0] ?? null;
  },
});

/** Run a single column test, judge the response, return Pass/Fail and reasons. */
export const runColumnTest = internalAction({
  args: {
    testCaseId: v.string(),
    userId: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
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
        assistantMessage: string;
        offerBlocksCount: number;
        threadId?: string;
      }
  > => {
    const testCase = COLUMN_TEST_CASES.find((t) => t.id === testCaseId);
    if (!testCase) {
      return { error: `Test case not found: ${testCaseId}` };
    }

    const replyResult = await ctx.runAction(
      internal.agents.actions.generateReplyAndReturnText,
      {
        userId,
        message: testCase.userMessage,
        channel,
      },
    );

    const trace = await ctx.runQuery(
      internal.agents.actions.getLatestTraceForThreadQuery,
      { threadId: replyResult.threadId },
    );
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
      assistantMessage: traceData.assistantMessage,
      offerBlocksCount: replyResult.offerBlocks?.length ?? 0,
      threadId: replyResult.threadId,
    };
  },
});

/** Run all column tests in order (dependent tests share thread via same userId). Returns Pass/Fail per row. */
export const runAllColumnTests = internalAction({
  args: {
    userId: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    testCaseIds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { userId, channel = "app", testCaseIds },
  ): Promise<{
    total: number;
    passCount: number;
    passRate: number;
    results: Array<{
      testCaseId: string;
      pass: boolean;
      reasons: string[];
      suggestions: string[];
    }>;
  }> => {
    const cases = testCaseIds
      ? COLUMN_TEST_CASES.filter((t) => testCaseIds.includes(t.id))
      : [...COLUMN_TEST_CASES];
    const results: Array<{
      testCaseId: string;
      pass: boolean;
      reasons: string[];
      suggestions: string[];
    }> = [];

    for (const tc of cases) {
      const r = await ctx.runAction(internal.agents.actions.runColumnTest, {
        testCaseId: tc.id,
        userId,
        channel,
      });
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
