/**
 * Agent tools API type – app API surface required by tools.
 */
import type { FunctionReference } from "convex/server";

export type AgentToolsApi = {
  properties: {
    search: FunctionReference<"query", "public">;
    getRecentSearchCount: FunctionReference<"query", "public" | "internal">;
    logSearchEvent: FunctionReference<"mutation", "public">;
    logKnowledgeResearch: FunctionReference<"mutation", "public">;
    getLastSearchContext: FunctionReference<"query", "public">;
    getLastSearchFindings: FunctionReference<"query", "public">;
    getCachedSearchResults: FunctionReference<"query", "public">;
    getGlobalSearchCache: FunctionReference<"query", "public">;
    upsertGlobalSearchCache: FunctionReference<"mutation", "public">;
    trackGlobalSearchCacheHit: FunctionReference<"mutation", "public">;
    getUserPropertyExposureKeys?: FunctionReference<"query", "public" | "internal">;
    trackUserPropertyExposure?: FunctionReference<"mutation", "public" | "internal">;
  };
  banks: {
    getById: FunctionReference<"query", "public">;
    getBySlug: FunctionReference<"query", "public">;
    getBundles: FunctionReference<"query", "public">;
  };
  partners: { list: FunctionReference<"query", "public"> };
  userProfiles: {
    getByUserId: FunctionReference<"query", "public" | "internal">;
    getRecentMessageCount: FunctionReference<"query", "public" | "internal">;
    upsert: FunctionReference<"mutation", "public" | "internal">;
  };
  knowledgePages: {
    getBySlug: FunctionReference<"query", "public">;
    list: FunctionReference<"query", "public">;
  };
  handoffs: {
    create: FunctionReference<"mutation", "public" | "internal">;
  };
  orders: {
    createDraftFromAgent: FunctionReference<"mutation", "public">;
  };
  memory?: {
    store?: FunctionReference<"mutation", "public" | "internal">;
    retrieve?: FunctionReference<"query", "public" | "internal">;
    getByKey?: FunctionReference<"query", "public" | "internal">;
    getRelevantContext?: FunctionReference<"query", "public" | "internal">;
    storeInteraction?: FunctionReference<"mutation", "public" | "internal">;
    storeEntityRelation?: FunctionReference<"mutation", "public" | "internal">;
    getRelatedEntities?: FunctionReference<"query", "public" | "internal">;
  };
};
