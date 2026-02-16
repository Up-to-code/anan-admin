/**
 * Agent trace logger for simulator replay and column test fixtures.
 * Logs per-turn: user message, tool calls, tool results, assistant message.
 */

export type AgentStep = {
  toolCalls?: Array<{ name?: string; toolName?: string; args?: unknown; input?: unknown }>;
  toolResults?: Array<{ name?: string; toolName?: string; output?: unknown; result?: unknown }>;
};

/**
 * Extract tool calls and results from agent steps for trace logging.
 */
export function extractTraceFromSteps(steps: unknown[] | undefined): {
  toolCalls: Array<{ name: string; args: unknown }>;
  toolResults: Array<{ name: string; result: unknown }>;
} {
  const toolCalls: Array<{ name: string; args: unknown }> = [];
  const toolResults: Array<{ name: string; result: unknown }> = [];

  if (!Array.isArray(steps)) return { toolCalls, toolResults };

  for (const step of steps as AgentStep[]) {
    if (Array.isArray(step.toolCalls)) {
      for (const tc of step.toolCalls) {
        const name = tc?.name ?? tc?.toolName;
        if (name) {
          toolCalls.push({ name, args: tc.args ?? tc.input ?? {} });
        }
      }
    }
    if (Array.isArray(step.toolResults)) {
      for (const tr of step.toolResults) {
        const name =
          (tr as { name?: string; toolName?: string }).name ??
          (tr as { name?: string; toolName?: string }).toolName ??
          "unknown";
        const result =
          (tr as { output?: unknown; result?: unknown }).output ??
          (tr as { output?: unknown; result?: unknown }).result ??
          tr;
        toolResults.push({ name, result });
      }
    }
  }
  return { toolCalls, toolResults };
}
