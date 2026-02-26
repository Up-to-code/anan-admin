/**
 * Agent debug test: runs one column test in-process so instrumentation
 * (agent_msg, agent_tool_smartPropertySearch, agent_tool_searchRealEstateInfo)
 * writes to .cursor/debug.log when the ingest server is running.
 *
 * Production: skipped in CI when OPENROUTER_API_KEY is unset.
 * Debug: Run with OPENROUTER_API_KEY set and ingest server running, then
 * check .cursor/debug.log for hypothesisId agent_msg and agent_tool_*.
 *
 * Run: OPENROUTER_API_KEY=xxx npm run test:once -- convex/agent.debug.test.ts
 */
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { modules } from "./test.setup";

const hasAgentEnv = Boolean(process.env.OPENROUTER_API_KEY);

test(
  "R4 market trends column test (skipped without OPENROUTER_API_KEY)",
  { timeout: 90_000, skip: !hasAgentEnv },
  async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(internal.agents.actions.runColumnTest, {
      testCaseId: "R4-general-market-trends",
      userId: "debug-agent-user",
      channel: "app",
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.pass).toBe(true);
  }
);
