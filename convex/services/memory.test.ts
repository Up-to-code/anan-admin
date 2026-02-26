/**
 * Memory service tests - store, recall, search summary, getRelevantMemoriesByQuery.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";
import { modules } from "../test.setup";

describe("memory service", () => {
  it("storeInternal stores preference and getRelevantMemoriesByQuery returns it", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const id = await ctx.runMutation(internal.services.memory.storeInternal, {
        userId: "mem-user-1",
        memoryType: "preference",
        key: "user_name",
        value: "Ahmed",
      });
      expect(id).toBeTruthy();
    });
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.services.memory.getRelevantMemoriesByQuery, {
        userId: "mem-user-1",
        query: "hi",
      });
    });
    expect(result).toBeTruthy();
    expect((result as { summary: string }).summary).toContain("user_name");
    expect((result as { summary: string }).summary).toContain("Ahmed");
    const prefs = (result as { preferences: { key: string; value: string }[] }).preferences;
    const userNamePref = prefs.find((p) => p.key === "user_name");
    expect(userNamePref?.value).toBe("Ahmed");
  });

  it("storeSearchSummaryInternal stores and getRelevantMemoriesByQuery includes last search", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.services.memory.storeSearchSummaryInternal, {
        userId: "mem-user-2",
        query: "apartments in Riyadh",
        locationHint: "Riyadh",
        budgetHint: "1M SAR",
        findingsCount: 5,
      });
    });
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.services.memory.getRelevantMemoriesByQuery, {
        userId: "mem-user-2",
        query: "apartments",
        limit: 10,
      });
    });
    expect(result).toBeTruthy();
    expect((result as { summary: string }).summary).toContain("Last search");
    expect((result as { summary: string }).summary).toContain("apartments in Riyadh");
    expect((result as { summary: string }).summary).toContain("Riyadh");
    expect((result as { lastSearchSummary: { query: string } }).lastSearchSummary?.query).toBe(
      "apartments in Riyadh"
    );
  });

  it("storeInternal overwrites existing same key and memoryType", async () => {
    const t = convexTest(schema, modules);
    const id1 = await t.run(async (ctx) => {
      return await ctx.runMutation(internal.services.memory.storeInternal, {
        userId: "mem-user-3",
        memoryType: "preference",
        key: "budget_preference",
        value: "500000",
      });
    });
    const id2 = await t.run(async (ctx) => {
      return await ctx.runMutation(internal.services.memory.storeInternal, {
        userId: "mem-user-3",
        memoryType: "preference",
        key: "budget_preference",
        value: "750000",
      });
    });
    expect(id1).toBe(id2);
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.services.memory.getRelevantMemoriesByQuery, {
        userId: "mem-user-3",
        query: "budget",
      });
    });
    const prefs = (result as { preferences: { key: string; value: string }[] }).preferences;
    const budgetPref = prefs.find((p) => p.key === "budget_preference");
    expect(budgetPref?.value).toBe("750000");
  });

  it("getRelevantMemoriesByQuery returns empty when user has no memory", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.services.memory.getRelevantMemoriesByQuery, {
        userId: "mem-user-empty",
        query: "anything",
      });
    });
    expect(result).toBeTruthy();
    expect((result as { preferences: unknown[] }).preferences).toEqual([]);
    expect((result as { constraints: unknown[] }).constraints).toEqual([]);
    expect((result as { lastSearchSummary: unknown }).lastSearchSummary).toBeNull();
    expect((result as { summary: string }).summary).toContain("No specific preferences");
  });
});
