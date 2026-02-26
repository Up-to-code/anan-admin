export type AgentRuntimeContext = {
  threadId?: string;
  userId?: string;
  channel?: "whatsapp" | "app" | "web";
  message: string;
};

export type SpecialistTask = {
  id: string;
  specialist:
  | "search_planner"
  | "search_retrieval"
  | "browse_extraction"
  | "search_judgement"
  | "memory"
  | "formatter";
  reason: string;
  parallelSafe: boolean;
};

export type SpecialistResult = {
  taskId: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
};

export type ExecutionPlan = {
  intent:
  | "property_search"
  | "market_info"
  | "loan"
  | "general"
  | "objection"
  | "property_details";
  confidence: number;
  delegate: boolean;
  tasks: SpecialistTask[];
};

export type FinalResponseEnvelope = {
  text: string;
  warnings?: string[];
  metadata?: Record<string, unknown>;
};
