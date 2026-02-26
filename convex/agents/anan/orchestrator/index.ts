/**
 * Agent Orchestrator - Canvas-inspired workflow orchestration.
 * Implements Plan-and-Execute pattern for intelligent tool coordination.
 */

export interface WorkflowStep {
  name: string;
  tool: string;
  input: string[];
  conditions?: Record<string, unknown>;
  parallel?: boolean;
  optional?: boolean;
  retryCount?: number;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  inputSchema: Record<string, string>;
}

export interface ExecutionContext {
  userId?: string;
  threadId?: string;
  channel?: "whatsapp" | "app" | "web";
  userInput: string;
  results: Map<string, unknown>;
  metadata: Record<string, unknown>;
}

export const PROPERTY_SEARCH_WORKFLOW: WorkflowDefinition = {
  name: "property_search",
  description: "Smart property search with memory integration",
  inputSchema: {
    query: "string - User's search query",
    userId: "string - User identifier",
    threadId: "string - Conversation thread",
  },
  steps: [
    {
      name: "loadMemory",
      tool: "getMemoryContext",
      input: ["query"],
    },
    {
      name: "enrichQuery",
      tool: "queryEnricher",
      input: ["query", "loadMemory.result"],
    },
    {
      name: "searchProperties",
      tool: "smartPropertySearch",
      input: ["enrichQuery.result"],
      parallel: false,
    },
    {
      name: "storeInsights",
      tool: "storeSearchInsights",
      input: ["searchProperties.results"],
      optional: true,
    },
  ],
};

export const PROPERTY_DETAILS_WORKFLOW: WorkflowDefinition = {
  name: "property_details",
  description: "Get detailed information about a specific property",
  inputSchema: {
    propertyUrl: "string - URL of the property",
    title: "string - Property title",
    userId: "string - User identifier",
  },
  steps: [
    {
      name: "getLastFindings",
      tool: "getLastSearchFindings",
      input: [],
    },
    {
      name: "fetchDetails",
      tool: "getMoreDetailsForProperty",
      input: ["propertyUrl", "title"],
    },
    {
      name: "trackInteraction",
      tool: "trackPropertyInteraction",
      input: ["fetchDetails.result", "propertyUrl"],
      optional: true,
    },
  ],
};

export const FINANCING_WORKFLOW: WorkflowDefinition = {
  name: "financing_inquiry",
  description: "Handle financing/bank product inquiries",
  inputSchema: {
    query: "string - User's financing question",
    userId: "string - User identifier",
  },
  steps: [
    {
      name: "loadMemory",
      tool: "getMemoryContext",
      input: ["query"],
    },
    {
      name: "getKnowledge",
      tool: "getKnowledgePage",
      input: ["query"],
      conditions: { topic: "financing" },
    },
    {
      name: "getBanks",
      tool: "getBundles",
      input: [],
    },
  ],
};

export type IntentType =
  | "property_search"
  | "property_details"
  | "financing"
  | "general"
  | "handoff"
  | "objection";

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  entities: Record<string, string>;
  suggestedWorkflow: WorkflowDefinition | null;
}

// Redundant classifyIntent removed; use classifyRuntimeIntent and detectSearchIntent.

function extractEntities(input: string): Record<string, string> {
  const entities: Record<string, string> = {};

  const budgetMatch = input.match(/(?:budget|ميزانية|حتى).{0,10}(\d{4,9})/i);
  if (budgetMatch) {
    entities.budget = budgetMatch[1];
  }

  const bedsMatch = input.match(/(\d+)\s*(?:bed|bedroom|غرف|غرفة)/i);
  if (bedsMatch) {
    entities.beds = bedsMatch[1];
  }

  const saudiCities = [
    "riyadh",
    "الرياض",
    "jeddah",
    "جدة",
    "جده",
    "dammam",
    "الدمام",
    "mecca",
    "مكة",
    "medina",
    "المدينة",
    "khobar",
    "الخبر",
  ];
  const inputLower = input.toLowerCase();
  for (const city of saudiCities) {
    if (inputLower.includes(city)) {
      entities.location = city;
      break;
    }
  }

  const typeMatch = input.match(
    /\b(apartment|villa|studio|duplex|penthouse|townhouse|شقة|فيلا|استوديو|دوبلكس)\b/i,
  );
  if (typeMatch) {
    entities.propertyType = typeMatch[1];
  }

  return entities;
}

export class WorkflowOrchestrator {
  private tools: Map<
    string,
    (ctx: ExecutionContext, input: Record<string, unknown>) => Promise<unknown>
  >;
  private workflows: Map<string, WorkflowDefinition>;

  constructor() {
    this.tools = new Map();
    this.workflows = new Map();

    this.registerWorkflow(PROPERTY_SEARCH_WORKFLOW);
    this.registerWorkflow(PROPERTY_DETAILS_WORKFLOW);
    this.registerWorkflow(FINANCING_WORKFLOW);
  }

  registerTool(
    name: string,
    handler: (
      ctx: ExecutionContext,
      input: Record<string, unknown>,
    ) => Promise<unknown>,
  ): void {
    this.tools.set(name, handler);
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.name, workflow);
  }

  async execute(
    workflowName: string,
    context: ExecutionContext,
  ): Promise<Map<string, unknown>> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }

    const pending = [...workflow.steps];
    const completed = new Set<string>();

    while (pending.length > 0) {
      const readySteps = pending.filter((step) =>
        step.input.every((inputKey) => {
          if (inputKey.includes(".")) {
            const [stepName] = inputKey.split(".");
            return completed.has(stepName);
          }
          return completed.has(inputKey) || context.results.has(inputKey);
        }),
      );

      if (readySteps.length === 0 && pending.length > 0) {
        throw new Error(
          `Circular dependency or missing input in workflow ${workflowName}`,
        );
      }

      for (const step of readySteps) {
        const tool = this.tools.get(step.tool);
        if (!tool) {
          if (step.optional) {
            completed.add(step.name);
            continue;
          }
          throw new Error(`Unknown tool: ${step.tool}`);
        }

        try {
          const input = this.resolveInput(step, context, completed);
          const result = await tool(context, input);
          context.results.set(step.name, result);
          completed.add(step.name);
        } catch (error) {
          if (step.optional) {
            completed.add(step.name);
            continue;
          }
          throw error;
        }

        pending.splice(pending.indexOf(step), 1);
      }
    }

    return context.results;
  }

  private resolveInput(
    step: WorkflowStep,
    context: ExecutionContext,
    completed: Set<string>,
  ): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    for (const inputKey of step.input) {
      if (inputKey.includes(".")) {
        const [stepName, field] = inputKey.split(".");
        if (completed.has(stepName)) {
          const stepResult = context.results.get(stepName);
          input[field] = this.getNestedValue(stepResult, field);
        }
      } else if (context.results.has(inputKey)) {
        input[inputKey] = context.results.get(inputKey);
      } else if (inputKey === "query") {
        input.query = context.userInput;
      } else if (inputKey === "userId") {
        input.userId = context.userId;
      } else if (inputKey === "threadId") {
        input.threadId = context.threadId;
      }
    }

    return input;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== "object") return undefined;
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
}

export function createOrchestrator(): WorkflowOrchestrator {
  return new WorkflowOrchestrator();
}

export {
  TOOL_REGISTRY,
  selectToolsForIntent,
  getToolByName,
  getToolsByCapability,
  resolveToolDependencies,
  planToolExecution,
  getToolCacheKey,
} from "./toolRegistry";
export type { ToolMetadata, ToolSelectionResult } from "./toolRegistry";
export { classifyRuntimeIntent } from "./intentClassifier";
export { buildSpecialistTasks } from "./toolPlanner";
export { createExecutionPlan } from "./executionPolicy";
export type {
  AgentRuntimeContext,
  SpecialistTask,
  SpecialistResult,
  ExecutionPlan,
  FinalResponseEnvelope,
} from "./types";
