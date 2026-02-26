/**
 * Legacy compatibility shim for older imports.
 * Canonical prompt policy is assembled in index.ts using routing/memory/responseContract modules.
 */

import { routingRules } from "./routing";
import { memoryRulesV2 } from "./memory";
import { responseContractRules } from "./responseContract";

export const reasoningBlock = routingRules;
export const realEstatePrompt = [memoryRulesV2, responseContractRules].join("\n\n");
