/**
 * Real estate agent – application layer.
 * Delegates to agents/anan for the new structure.
 */
import { createAnanAgent } from "../../agents/anan/agent";
import type { AgentToolsApi } from "../../agents/anan/tools";

/** Create the real estate agent with tools bound to the given api. */
export function createRealEstateAgent(appApi: AgentToolsApi) {
  return createAnanAgent(appApi);
}
