/**
 * Anan agent instructions. Channel-aware for WhatsApp vs App formatting.
 */

import type { Channel } from "../../../channels/types";
import { systemPrompt } from "./system";
import { reasoningBlock, realEstatePrompt } from "./realEstate";
import { WHATSAPP_RULES, APP_RULES, WEB_RULES } from "./channels";
import { toolsPrompt } from "./toolsSummary";

/**
 * Build agent instructions. Optional channel for WhatsApp-specific rules.
 */
export function buildAgentInstructions(channel?: Channel): string {
  const base = [systemPrompt, reasoningBlock, realEstatePrompt, toolsPrompt].join("\n\n");
  if (channel === "whatsapp") return base + WHATSAPP_RULES;
  if (channel === "app") return base + APP_RULES;
  if (channel === "web") return base + WEB_RULES;
  return base;
}
