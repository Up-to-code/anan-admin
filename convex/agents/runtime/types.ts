import type { AgentChannel } from "../actions/shared";

export interface AgentRuntimeContext {
  threadId: string;
  userId?: string;
  channel?: AgentChannel;
}

export interface ModelAttemptResult {
  model: string;
  success: boolean;
  reason?: string;
}

export interface SearchFilterResult {
  excludedUrls: string[];
  keptCount: number;
}
