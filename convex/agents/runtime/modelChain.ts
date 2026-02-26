import { api, internal } from "../../_generated/api";
import { createRealEstateAgent } from "../../features/agent/factory";
import { getRoutedModel } from "../modelRouter";
import { getAgentLLMConfigSafe } from "../config";
import { buildModelFallbackChain } from "../modelFailover";
import { isProductionAgentEnv } from "./env";
import { assertProductionModelPolicy } from "./modelPolicy";

const realEstateAgentApi = {
  properties: {
    search: api.services.properties.search,
    getRecentSearchCount: internal.services.properties.getRecentSearchCountInternal,
    logSearchEvent: api.services.properties.logSearchEvent,
    logKnowledgeResearch: api.services.properties.logKnowledgeResearch,
    getLastSearchContext: api.services.properties.getLastSearchContext,
    getLastSearchFindings: api.services.properties.getLastSearchFindings,
    getCachedSearchResults: api.services.properties.getCachedSearchResults,
    getGlobalSearchCache: api.services.properties.getGlobalSearchCache,
    upsertGlobalSearchCache: api.services.properties.upsertGlobalSearchCache,
    trackGlobalSearchCacheHit: api.services.properties.trackGlobalSearchCacheHit,
    getUserPropertyExposureKeys: internal.services.properties.getUserPropertyExposureKeys,
    trackUserPropertyExposure: internal.services.properties.trackUserPropertyExposure,
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
  memory: {
    store: internal.services.memory.storeInternal,
    getRelevantContext: internal.services.memory.getRelevantContextInternal,
    storeInteraction: internal.services.memory.storeInteractionInternal,
    storeEntityRelation: internal.services.memory.storeEntityRelationInternal,
  },
};

const agentByModelCache = new Map<
  string,
  ReturnType<typeof createRealEstateAgent>
>();

export function getAgentByModel(
  modelOverride?: string,
): ReturnType<typeof createRealEstateAgent> {
  const cacheKey = modelOverride ?? "__default__";
  const cached = agentByModelCache.get(cacheKey);
  if (cached) return cached;
  const created = createRealEstateAgent(realEstateAgentApi, { modelOverride });
  agentByModelCache.set(cacheKey, created);
  return created;
}

export function getRealEstateAgentForTraffic(params: {
  threadId?: string;
  userId?: string;
}): { agent: ReturnType<typeof createRealEstateAgent>; selectedModel?: string } {
  const routingKey = params.threadId ?? params.userId ?? "default";
  const selectedModel = getRoutedModel(routingKey);
  return { agent: getAgentByModel(selectedModel), selectedModel };
}

export function resolveModelFallbackChain(selectedModel?: string): string[] {
  const defaultModel = getAgentLLMConfigSafe()?.model;
  const chain = buildModelFallbackChain({
    selectedModel,
    defaultModel,
    configuredFallbacksRaw: process.env.AGENT_MODEL_FALLBACKS,
    demoFallbacksRaw: isProductionAgentEnv()
      ? undefined
      : process.env.AGENT_DEMO_FREE_MODELS,
  });
  assertProductionModelPolicy({ selectedModel, defaultModel, fallbacks: chain });
  return chain;
}
