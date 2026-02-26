/**
 * Legacy compatibility shim.
 * Canonical routing/tool policy now lives in routing.ts (priority stack v0.0.9).
 */

import { routingRules } from "./routing";

export const toolsPrompt = routingRules;
