/**
 * Agent tools API type – app API surface required by tools.
 */
import type { FunctionReference } from "convex/server";

export type AgentToolsApi = {
  properties: {
    search: FunctionReference<"query", "public">;
    getRecentSearchCount: FunctionReference<"query", "public">;
    logSearchEvent: FunctionReference<"mutation", "public">;
    logKnowledgeResearch: FunctionReference<"mutation", "public">;
    getLastSearchContext: FunctionReference<"query", "public">;
    getLastSearchFindings: FunctionReference<"query", "public">;
    getCachedSearchResults: FunctionReference<"query", "public">;
  };
  banks: {
    getById: FunctionReference<"query", "public">;
    getBySlug: FunctionReference<"query", "public">;
    getBundles: FunctionReference<"query", "public">;
  };
  partners: { list: FunctionReference<"query", "public"> };
  userProfiles: {
    getByUserId: FunctionReference<"query", "public">;
    getRecentMessageCount: FunctionReference<"query", "public">;
    upsert: FunctionReference<"mutation", "public">;
  };
  knowledgePages: {
    getBySlug: FunctionReference<"query", "public">;
    list: FunctionReference<"query", "public">;
  };
  handoffs: {
    create: FunctionReference<"mutation", "public">;
  };
  orders: {
    createDraftFromAgent: FunctionReference<"mutation", "public">;
  };
  memory?: {
    store: FunctionReference<"mutation", "public">;
    retrieve: FunctionReference<"query", "public">;
    getByKey: FunctionReference<"query", "public">;
    getRelevantContext: FunctionReference<"query", "public">;
    storeInteraction: FunctionReference<"mutation", "public">;
    storeEntityRelation: FunctionReference<"mutation", "public">;
    getRelatedEntities: FunctionReference<"query", "public">;
  };
};
