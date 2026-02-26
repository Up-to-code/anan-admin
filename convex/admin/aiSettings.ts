/**
 * AI Settings management - models, temperature, agent config.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";

// Default settings
const DEFAULT_SETTINGS: Record<string, string> = {
  defaultModel: "moonshotai/kimi-k2-thinking",
  searchModel: "moonshotai/kimi-k2-thinking",
  maxTokens: "4096",
  temperature: "0.7",
  enableCache: "true",
  enableStreaming: "true",
  agentName: "عنان",
  agentLanguage: "ar",
  welcomeMessage: "مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟",
  enableWebSearch: "true",
  enableAutoHandoff: "true",
  enableContextMemory: "true",
};

/**
 * List all AI settings with defaults for missing keys.
 */
export const aiSettingsList = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.optional(v.id("aiSettings")),
      key: v.string(),
      value: v.string(),
      _creationTime: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("aiSettings").collect();
    const result: Array<{
      _id?: any;
      key: string;
      value: string;
      _creationTime?: number;
    }> = [];

    // Start with defaults
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      const found = existing.find((r) => r.key === key);
      result.push({
        _id: found?._id,
        key,
        value: found?.value ?? defaultValue,
        _creationTime: found?._creationTime,
      });
    }

    // Add any custom settings not in defaults
    for (const setting of existing) {
      if (!DEFAULT_SETTINGS[setting.key]) {
        result.push({
          _id: setting._id,
          key: setting.key,
          value: setting.value,
          _creationTime: setting._creationTime,
        });
      }
    }

    return result;
  },
});

/**
 * Get a single AI setting value.
 */
export const aiSettingsGet = query({
  args: { key: v.string() },
  returns: v.string(),
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("key", (q) => q.eq("key", key))
      .first();
    return existing?.value ?? DEFAULT_SETTINGS[key] ?? "";
  },
});

/**
 * Update a single AI setting.
 */
export const aiSettingsUpdate = mutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, { key, value }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("aiSettings", { key, value });
    }
    return null;
  },
});

/**
 * Update multiple AI settings at once.
 */
export const aiSettingsBatchUpdate = mutation({
  args: { settings: v.array(v.object({ key: v.string(), value: v.string() })) },
  returns: v.null(),
  handler: async (ctx, { settings }) => {
    await requireAdmin(ctx);
    for (const { key, value } of settings) {
      const existing = await ctx.db
        .query("aiSettings")
        .withIndex("key", (q) => q.eq("key", key))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { value });
      } else {
        await ctx.db.insert("aiSettings", { key, value });
      }
    }
    return null;
  },
});

/**
 * Reset a setting to its default value.
 */
export const aiSettingsReset = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      if (DEFAULT_SETTINGS[key] !== undefined) {
        await ctx.db.patch(existing._id, { value: DEFAULT_SETTINGS[key] });
      } else {
        await ctx.db.delete(existing._id);
      }
    }
    return null;
  },
});
