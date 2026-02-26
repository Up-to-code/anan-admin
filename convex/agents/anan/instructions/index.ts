/**
 * Anan agent instructions. Channel-aware for WhatsApp vs App formatting.
 */

import type { Channel } from "../../../channels/types";
import { systemPrompt } from "./system";
import { WHATSAPP_RULES, APP_RULES, WEB_RULES } from "./channels";
import { routingRules } from "./routing";
import { memoryRulesV2 } from "./memory";
import { responseContractRules } from "./responseContract";
import { searchRules } from "./searchRules";
import { memoryRules } from "./memoryRules";
import { channelRules } from "./channelRules";

export const PROMPT_POLICY_VERSION = "v0.0.9";

export function isPromptPolicyV2Enabled(): boolean {
  return process.env.PROMPT_POLICY_V2_ENABLED !== "false";
}

/**
 * Build agent instructions. Optional channel for WhatsApp-specific rules.
 */
export function buildAgentInstructions(channel?: Channel): string {
  const channelAdapter =
    channel === "whatsapp" ? WHATSAPP_RULES : channel === "web" ? WEB_RULES : APP_RULES;

  if (!isPromptPolicyV2Enabled()) {
    return [systemPrompt, searchRules, memoryRules, channelRules, channelAdapter].join(
      "\n\n",
    );
  }

  const base = [
    `PROMPT_POLICY_VERSION: ${PROMPT_POLICY_VERSION}`,
    `PROMPT_POLICY_V2_ENABLED: ${isPromptPolicyV2Enabled()}`,
    `INSTRUCTION_PRIORITY_STACK:
1) identity+safety+language
2) routing+tools
3) memory+recall
4) response contract
5) channel adapter`,
    systemPrompt,
    routingRules,
    memoryRulesV2,
    responseContractRules,
  ].join("\n\n");
  return `${base}\n\n${channelAdapter}`;
}
