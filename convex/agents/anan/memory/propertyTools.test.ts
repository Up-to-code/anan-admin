import { describe, expect, it, vi } from "vitest";
import { decode } from "@toon-format/toon";
import { createAgentTools, type AgentToolsApi } from "../tools";
import { createMemoryAwarePropertyTools } from "./propertyTools";

const baseAppApi = {
  properties: {
    search: {} as any,
    getRecentSearchCount: {} as any,
    logSearchEvent: {} as any,
    logKnowledgeResearch: {} as any,
    getLastSearchContext: {} as any,
    getLastSearchFindings: {} as any,
    getCachedSearchResults: {} as any,
    getGlobalSearchCache: {} as any,
    upsertGlobalSearchCache: {} as any,
    trackGlobalSearchCacheHit: {} as any,
  },
  banks: {
    getById: {} as any,
    getBySlug: {} as any,
    getBundles: {} as any,
  },
  partners: { list: {} as any },
  userProfiles: {
    getByUserId: {} as any,
    getRecentMessageCount: {} as any,
    upsert: {} as any,
  },
  knowledgePages: {
    getBySlug: {} as any,
    list: {} as any,
  },
  handoffs: { create: {} as any },
  orders: { createDraftFromAgent: {} as any },
} satisfies AgentToolsApi;

function decodeToolResult(value: unknown): any {
  return typeof value === "string" ? decode(value) : value;
}

describe("anan memory tools", () => {
  it("registers memory tools only when complete memory api is provided", () => {
    const withoutMemory = createAgentTools(baseAppApi);
    expect((withoutMemory as Record<string, unknown>).storeUserPreference).toBeUndefined();

    const withMemory = createAgentTools({
      ...baseAppApi,
      memory: {
        store: {} as any,
        storeInteraction: {} as any,
        storeEntityRelation: {} as any,
        getRelevantContext: {} as any,
      },
    });
    expect(typeof (withMemory as Record<string, unknown>).storeUserPreference).toBe("object");
    expect(typeof (withMemory as Record<string, unknown>).getMemoryContext).toBe("object");
  });

  it("storeUserPreference returns structured failure when memory write throws", async () => {
    const tools = createMemoryAwarePropertyTools(baseAppApi, {
      store: {} as any,
      storeInteraction: {} as any,
      storeEntityRelation: {} as any,
      getRelevantContext: {} as any,
    });
    (tools.storeUserPreference as any).ctx = {
      userId: "u-memory-fail",
      runMutation: vi.fn().mockRejectedValue(new Error("boom")),
    };

    const encoded = await (tools.storeUserPreference as any).execute(
      { key: "budget_preference", value: "900000" },
      {} as any,
    );
    const result = decodeToolResult(encoded);

    expect(result.success).toBe(false);
    expect(result.reason).toContain("Failed to store preference");
  });

  it("getSimilarPropertiesFromMemory handles malformed memory context safely", async () => {
    const tools = createMemoryAwarePropertyTools(baseAppApi, {
      store: {} as any,
      storeInteraction: {} as any,
      storeEntityRelation: {} as any,
      getRelevantContext: {} as any,
    });
    (tools.getSimilarPropertiesFromMemory as any).ctx = {
      userId: "u-memory-safe",
      runQuery: vi.fn().mockResolvedValue({ recentInteractions: null }),
    };

    const encoded = await (tools.getSimilarPropertiesFromMemory as any).execute(
      { limit: 5 },
      {} as any,
    );
    const result = decodeToolResult(encoded);

    expect(result.properties).toEqual([]);
  });
});
