/**
 * Anan agent tools – composes domain tool modules.
 */
import type { AgentToolsApi } from "./types";
import type { FunctionReference } from "convex/server";
import { createPropertyTools } from "./property";
import { createBanksTools } from "./banks";
import { createProfileTools } from "./profile";
import { createKnowledgeTools } from "./knowledge";
import { createHandoffTools } from "./handoff";
import { createWebTools } from "./web";
import { createFormatTools } from "./format";
import { createMemoryAwarePropertyTools } from "../memory";

export type { AgentToolsApi } from "./types";

type MemoryApi = {
  store: FunctionReference<"mutation", "public">;
  storeInteraction: FunctionReference<"mutation", "public">;
  storeEntityRelation: FunctionReference<"mutation", "public">;
  getRelevantContext: FunctionReference<"query", "public">;
};

export function createAgentTools(appApi: AgentToolsApi) {
  const propertyTools = createPropertyTools(appApi);
  const banksTools = createBanksTools(appApi);
  const profileTools = createProfileTools(appApi);
  const knowledgeTools = createKnowledgeTools(appApi);
  const handoffTools = createHandoffTools(appApi);
  const webTools = createWebTools(appApi);
  const formatTools = createFormatTools();

  const memoryTools = appApi.memory
    ? createMemoryAwarePropertyTools(
        appApi,
        appApi.memory as unknown as MemoryApi,
      )
    : {};

  return {
    ...propertyTools,
    ...banksTools,
    ...profileTools,
    ...knowledgeTools,
    ...handoffTools,
    ...webTools,
    ...formatTools,
    ...memoryTools,
  };
}
