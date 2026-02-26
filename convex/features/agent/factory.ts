/**
 * Real estate agent – application layer.
 * Delegates to agents/anan for the new structure.
 */
import { createAnanAgent } from "../../agents/anan/agent";
import type { AgentToolsApi } from "../../agents/anan/tools";

type AgentFactoryOptions = {
  modelOverride?: string;
};

/** Create the real estate agent with tools bound to the given api. */
export function createRealEstateAgent(
  appApi: AgentToolsApi,
  options?: AgentFactoryOptions,
) {
  return createAnanAgent(appApi, options);
}
