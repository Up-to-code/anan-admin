/**
 * User profile tools.
 */
import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { z } from "zod";
import { debugLog } from "../../debug";
import type { AgentToolsApi } from "./types";

export function createProfileTools(appApi: AgentToolsApi) {
  const getUserProfile = createTool({
    description:
      "Get stored profile for the current user (salary, employment, kids, preferences, and plan fields). Call BEFORE asking for this info—if profile is empty, ask the user and then save with saveUserProfile.",
    args: z.object({}),
    handler: async (ctx) => {
      const userId = (ctx as { userId?: string }).userId;
      if (!userId) return toonEncode({ error: "No userId in context" });
      const profile = await ctx.runQuery(appApi.userProfiles.getByUserId, {
        userId,
      });
      return toonEncode(profile ?? {});
    },
  });

  const checkUserLimits = createTool({
    description:
      "Check if user can continue chatting based on profile plan and daily chat limit. Call when you need to verify user eligibility before long flows.",
    args: z.object({
      windowHours: z
        .number()
        .optional()
        .default(24)
        .describe("Lookback window for chat limits in hours"),
    }),
    handler: async (ctx, { windowHours }) => {
      const userId = (ctx as { userId?: string }).userId;
      if (!userId) return toonEncode({ error: "No userId in context" });
      debugLog("tools.checkUserLimits", "start", { userId, windowHours });
      const profile = await ctx.runQuery(appApi.userProfiles.getByUserId, {
        userId,
      });
      const now = Date.now();
      const sinceMs = now - windowHours * 60 * 60 * 1000;
      const recentMessageCount = await ctx.runQuery(
        appApi.userProfiles.getRecentMessageCount,
        {
          userId,
          sinceMs,
        },
      );
      const planType = profile?.planType ?? "free";
      const chatLimit = profile?.chatLimit;
      const planExpiresAt = profile?.planExpiresAt;
      const planExpired =
        typeof planExpiresAt === "number" && now > planExpiresAt;
      const limitExceeded =
        typeof chatLimit === "number" && recentMessageCount >= chatLimit;
      const allowed = !planExpired && !limitExceeded;
      debugLog("tools.checkUserLimits", "result", {
        userId,
        allowed,
        reason: planExpired
          ? "plan_expired"
          : limitExceeded
            ? "chat_limit_reached"
            : "ok",
        planType,
        recentMessageCount,
      });
      return toonEncode({
        allowed,
        reason: planExpired
          ? "plan_expired"
          : limitExceeded
            ? "chat_limit_reached"
            : "ok",
        planType,
        planExpiresAt,
        chatLimit,
        recentMessageCount,
        windowHours,
      });
    },
  });

  const saveUserProfile = createTool({
    description:
      "Save user info (salary, employment, kids, preferences) after the user shares it. Call AFTER user provides data.",
    args: z.object({
      salary: z.number().optional().describe("Annual salary in local currency"),
      employment: z
        .string()
        .optional()
        .describe("e.g. employed, self-employed"),
      employer: z.string().optional().describe("Company name where user works"),
      firstTimeBuyer: z.boolean().optional(),
      kids: z.number().optional().describe("Number of children"),
      minBeds: z.number().optional().describe("Minimum bedrooms needed"),
      maxBudget: z.number().optional().describe("Max budget for property"),
      preferredLocation: z
        .string()
        .optional()
        .describe("e.g. Riyadh, Jeddah, Europe"),
      preferredFloor: z.string().optional().describe("e.g. ground, first, any"),
      needsParking: z.boolean().optional().describe("User needs parking spot"),
      propertyType: z
        .string()
        .optional()
        .describe("e.g. apartment, villa, townhouse"),
      finishes: z.string().optional().describe("e.g. modern, classic, any"),
      name: z.string().optional(),
    }),
    handler: async (ctx, args) => {
      const userId = (ctx as { userId?: string }).userId;
      if (!userId) return toonEncode({ error: "No userId in context" });
      await ctx.runMutation(appApi.userProfiles.upsert, { userId, ...args });
      return toonEncode({ success: true });
    },
  });

  return { getUserProfile, checkUserLimits, saveUserProfile };
}
