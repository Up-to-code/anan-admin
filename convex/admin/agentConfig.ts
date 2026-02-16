/**
 * Admin-only agent LLM config – exposes current mode and model (read-only).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { getAgentLLMConfigSafe } from "../agents/config";

export const agentLLMConfig = query({
  args: {},
  returns: v.union(
    v.object({ mode: v.string(), model: v.string() }),
    v.object({ error: v.string() })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const config = getAgentLLMConfigSafe();
    if (!config) {
      return { error: "LLM config not available (check Convex env vars)" };
    }
    return { mode: config.mode, model: config.model };
  },
});
