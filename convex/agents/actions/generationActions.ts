import { saveMessage } from "@convex-dev/agent";
import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { components, internal } from "../../_generated/api";
import { formatForChannel, type OfferBlock } from "../../channels/formatters";
import { debugLog, withDebugTiming } from "../debug";
import { runOfferFormatterAgent } from "../anan/files/offerFormatter";
import { extractTraceFromSteps } from "../anan/testing/traceLogger";
import {
  extractRateLimitMessage,
  isModelFailoverError,
  isRateLimitedError,
} from "../modelFailover";
import { runWithModelFailover } from "../runtime/modelFailoverRunner";
import { CHANNEL_VALIDATOR } from "./shared";
import { buildSystemInstructions } from "../runtime/instructionBuilder";
import { getPromptPolicyMetadata } from "../runtime/instructionBuilder";
import {
  getAgentByModel,
  getRealEstateAgentForTraffic,
  resolveModelFallbackChain,
} from "../runtime/modelChain";
import { sleepMs } from "../runtime/rateLimitCooldown";
import {
  AGENT_FALLBACK_MESSAGE,
  persistAgentFallbackMessage,
} from "../runtime/fallbackMessage";
import { resolveReplyThread } from "../runtime/threadResolver";
import { getWhatsAppLeadText } from "../runtime/channelMessages";
import { logMessageSentActivity } from "../runtime/activityLogger";
import { persistInferredMemoryFacts } from "../runtime/memoryPersistence";
import {
  detectPreferredLanguage,
  isLikelyLanguageMismatch,
  languageGuardFallback,
} from "../../lib/language";
import { createExecutionPlan } from "../anan/orchestrator";

type SuggestedAction = {
  id: string;
  label: string;
  action: string;
  payload?: unknown;
};

function buildSuggestedActions(params: {
  preferredLanguage: "ar" | "en";
  responseMode?: "search_list" | "single_property_detail" | "general_info";
  hasOffers: boolean;
}): SuggestedAction[] {
  const { preferredLanguage, responseMode, hasOffers } = params;
  if (!hasOffers && responseMode !== "general_info") return [];
  if (preferredLanguage === "ar") {
    if (responseMode === "single_property_detail") {
      return [
        { id: "more_like_this", label: "خيارات مشابهة", action: "خيارات مشابهة" },
        { id: "book_visit", label: "احجز معاينة", action: "أبغى أحجز معاينة" },
      ];
    }
    if (responseMode === "search_list") {
      return [
        { id: "details_1", label: "تفاصيل 1", action: "تفاصيل عن #1" },
        { id: "compare_top", label: "قارن بينهم", action: "قارن أفضل 3 خيارات" },
        { id: "more_options", label: "خيارات أكثر", action: "خيارات أكثر" },
      ];
    }
    return [{ id: "next_step", label: "أكمل الخطوة التالية", action: "كمل الخطوة التالية" }];
  }
  if (responseMode === "single_property_detail") {
    return [
      { id: "more_like_this", label: "Similar options", action: "Show similar options" },
      { id: "book_visit", label: "Book viewing", action: "Book a viewing" },
    ];
  }
  if (responseMode === "search_list") {
    return [
      { id: "details_1", label: "Details #1", action: "Details for #1" },
      { id: "compare_top", label: "Compare top", action: "Compare top 3 options" },
      { id: "more_options", label: "More options", action: "Show more options" },
    ];
  }
  return [{ id: "next_step", label: "Next step", action: "Continue with next step" }];
}

export const logAgentTrace = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.optional(v.string()),
    channel: v.optional(CHANNEL_VALIDATOR),
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

export const generateResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    channel: v.optional(CHANNEL_VALIDATOR),
  },
  handler: async (ctx, { threadId, promptMessageId, channel }) => {
    debugLog("actions.generateResponse", "start", { threadId, promptMessageId, channel });
    try {
      const thread = await ctx.runQuery(components.agent.threads.getThread, { threadId });
      const userId = thread?.userId ?? undefined;
      const instructions = await withDebugTiming(
        "actions.generateResponse",
        "load_instructions",
        { threadId, channel },
        async () => buildSystemInstructions(ctx, { channel, userId, query: "" }),
      );
      debugLog("actions.generateResponse", "prompt_policy", getPromptPolicyMetadata());
      await withDebugTiming(
        "actions.generateResponse",
        "generate_text",
        { threadId, promptMessageId, channel, hasUserId: Boolean(userId) },
        async () => {
          const routed = getRealEstateAgentForTraffic({ threadId, userId });
          const modelsToTry = resolveModelFallbackChain(routed.selectedModel);
          try {
            await runWithModelFailover({
              models: modelsToTry,
              scope: "actions.generateResponse",
              threadId,
              runModel: async (model) => {
                await getAgentByModel(model).generateText(
                  ctx,
                  { threadId, userId, channel } as any,
                  { promptMessageId, system: instructions } as any,
                );
              },
            });
          } catch (failoverErr) {
            if (isModelFailoverError(failoverErr)) {
              debugLog("actions.generateResponse", "rate_limited_drop", { threadId, promptMessageId });
              await persistAgentFallbackMessage(ctx, {
                threadId,
                userId,
                promptMessageId,
                text: AGENT_FALLBACK_MESSAGE,
              });
              return;
            }
            throw failoverErr;
          }
        },
      );
      debugLog("actions.generateResponse", "done", { threadId, promptMessageId, channel });
    } catch (err) {
      if (isModelFailoverError(err)) {
        debugLog("actions.generateResponse", "rate_limited_error", {
          threadId,
          promptMessageId,
          channel,
          message: extractRateLimitMessage(err),
        });
      } else {
        console.error("generateResponse error:", err);
      }
      debugLog("actions.generateResponse", "error", {
        threadId,
        promptMessageId,
        channel,
        error: err instanceof Error ? err.message : "unknown_error",
      });
      if (isModelFailoverError(err)) {
        debugLog("actions.generateResponse", "rate_limited_suppressed", { threadId, promptMessageId });
        await persistAgentFallbackMessage(ctx, {
          threadId,
          userId: undefined,
          promptMessageId,
          text: AGENT_FALLBACK_MESSAGE,
        });
        return;
      }
      throw err;
    }
  },
});

export const generateReplyAndReturnText = internalAction({
  args: { userId: v.string(), message: v.string(), channel: v.optional(CHANNEL_VALIDATOR) },
  handler: async (
    ctx,
    { userId, message, channel: channelArg },
  ): Promise<{
    text: string;
    imageUrl?: string;
    imageUrls?: string[];
    offerBlocks?: OfferBlock[];
    responseMode?: "search_list" | "single_property_detail" | "general_info";
    allowLinks?: boolean;
    traceId?: string;
    silentRetryAttempts?: number;
    suggestedActions?: SuggestedAction[];
    engagementMode?: "action_first";
    threadId: string;
  }> => {
    debugLog("actions.generateReplyAndReturnText", "start", {
      userId,
      channel: channelArg ?? "app",
      messageLength: message.length,
    });
    let threadId = "";
    let promptMessageId: string | undefined;
    try {
      const channel = channelArg ?? "app";
      const threadSelection = await resolveReplyThread(ctx, { userId, message, channel });
      threadId = threadSelection.threadId;
      const executionPlan = createExecutionPlan({
        threadId,
        userId,
        channel,
        message,
      });
      debugLog("actions.generateReplyAndReturnText", "execution_plan", {
        threadId,
        userId,
        channel,
        intent: executionPlan.intent,
        confidence: executionPlan.confidence,
        delegate: executionPlan.delegate,
        taskCount: executionPlan.tasks.length,
      });
      if (threadSelection.rolledOver) {
        debugLog("actions.generateReplyAndReturnText", "thread_rollover_24h", {
          userId,
          previousThreadId: threadSelection.previousThreadId,
          threadId,
          channel,
        });
      }
      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        userId,
        prompt: message,
      });
      promptMessageId = messageId;
      await ctx.runMutation(internal.agents.actions.touchThreadMetadata, { threadId, userId, channel });
      await logMessageSentActivity(ctx, { userId, channel, threadId });
      await persistInferredMemoryFacts(ctx, { userId, threadId, message });
      const finalInstructions = await buildSystemInstructions(ctx, { channel, userId, query: message });
      debugLog(
        "actions.generateReplyAndReturnText",
        "prompt_policy",
        getPromptPolicyMetadata(),
      );
      const startedAt = Date.now();
      const maxSilentRetries = 2;
      const maxSilentRetryBudgetMs = 4000;
      let silentRetryAttempts = 0;
      let result: any;
      let lastSilentError: unknown;
      for (let outerAttempt = 0; outerAttempt <= maxSilentRetries; outerAttempt += 1) {
        try {
          result = await withDebugTiming(
            "actions.generateReplyAndReturnText",
            "generate_text",
            { threadId, userId, channel, outerAttempt },
            async () => {
              const routed = getRealEstateAgentForTraffic({ threadId, userId });
              const modelsToTry = resolveModelFallbackChain(routed.selectedModel);
              return await runWithModelFailover({
                models: modelsToTry,
                scope: "actions.generateReplyAndReturnText",
                threadId,
                runModel: (model) =>
                  getAgentByModel(model).generateText(
                    ctx,
                    { threadId, userId, channel } as any,
                    { promptMessageId: messageId, system: finalInstructions } as any,
                  ),
              });
            },
          );
          break;
        } catch (error) {
          lastSilentError = error;
          const canRetry =
            isModelFailoverError(error) &&
            outerAttempt < maxSilentRetries &&
            Date.now() - startedAt < maxSilentRetryBudgetMs;
          if (!canRetry) throw error;
          silentRetryAttempts += 1;
          await sleepMs(Math.min(250 * (outerAttempt + 1), 1000));
        }
      }
      if (!result) throw lastSilentError ?? new Error("No result from generation");
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
      const usedSearchContext = toolCalls.some((call) => call.name === "getLastSearchContext");
      const toolOutputsForImage: unknown[] = [];
      if (result.steps) {
        for (const step of result.steps) {
          const stepToolResults = (step as { toolResults?: Array<{ output?: unknown }> }).toolResults;
          if (!stepToolResults) continue;
          for (const tr of stepToolResults) {
            const output = (tr as { output?: unknown }).output ?? tr;
            if (output) toolOutputsForImage.push(output);
          }
        }
      }
      const preferredLanguage = detectPreferredLanguage(message);
      const allowLinks = /\b(link|url|urls|الرابط|روابط|لينك)\b/i.test(message);
      const formatted = formatForChannel(text, channel, {
        extractImageFromToolOutput: toolOutputsForImage.length > 0 ? toolOutputsForImage : undefined,
        preferredLanguage,
        detailedOffers: channel === "whatsapp",
        allowLinks,
      });
      const offerFormatted =
        channel === "whatsapp" && (formatted.offerBlocks?.length ?? 0) > 0
          ? runOfferFormatterAgent({
            offerBlocks: formatted.offerBlocks ?? [],
            preferredLanguage,
            query: message,
            maxImagesPerOffer: 5,
          })
          : undefined;
      const offerContent = (offerFormatted?.offerBlocks ?? formatted.offerBlocks ?? [])
        .map((b: any) => `${b.title} ${b.description}`)
        .join(" ");
      const combinedContent = `${text} ${offerContent}`;

      const isMismatch = isLikelyLanguageMismatch(combinedContent, preferredLanguage);
      let guardedText = isMismatch
        ? languageGuardFallback(preferredLanguage)
        : formatted.text;

      const finalOfferBlocks = isMismatch
        ? []
        : (offerFormatted?.offerBlocks ?? formatted.offerBlocks ?? []);

      const effectiveResponseMode =
        formatted.responseMode ??
        (finalOfferBlocks.length > 0 ? "search_list" : "general_info");

      if (!isMismatch && channel === "whatsapp" && finalOfferBlocks.length > 0) {
        guardedText = offerFormatted?.leadText
          ? offerFormatted.leadText
          : getWhatsAppLeadText({
            preferredLanguage,
            isFollowUp: isFollowUpRefresh || usedSearchContext,
          });
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
      return {
        text: guardedText,
        imageUrl: formatted.imageUrl ?? formatted.imageUrls?.[0],
        imageUrls: formatted.imageUrls,
        offerBlocks: finalOfferBlocks,
        allowLinks: formatted.allowLinks ?? allowLinks,
        traceId: `${threadId}:${Date.now()}`,
        silentRetryAttempts,
        responseMode: effectiveResponseMode,
        suggestedActions: buildSuggestedActions({
          preferredLanguage,
          responseMode: effectiveResponseMode,
          hasOffers: (finalOfferBlocks?.length ?? 0) > 0,
        }),
        engagementMode: "action_first",
        threadId,
      };
    } catch (err) {
      if (isModelFailoverError(err)) {
        debugLog("actions.generateReplyAndReturnText", "rate_limited_error", {
          userId,
          channel: channelArg ?? "app",
          threadId,
          message: extractRateLimitMessage(err),
        });
      } else {
        console.error("generateReplyAndReturnText error:", err);
      }
      debugLog("actions.generateReplyAndReturnText", "error", {
        userId,
        channel: channelArg ?? "app",
        error: err instanceof Error ? err.message : "unknown_error",
      });
      if (threadId && promptMessageId) {
        await persistAgentFallbackMessage(ctx, {
          threadId,
          userId,
          promptMessageId,
          text: AGENT_FALLBACK_MESSAGE,
        });
      }
      return { text: AGENT_FALLBACK_MESSAGE, threadId };
    }
  },
});

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
