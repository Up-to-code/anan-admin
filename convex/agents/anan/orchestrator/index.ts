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
  | "handoff";

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  entities: Record<string, string>;
  suggestedWorkflow: WorkflowDefinition | null;
}

export function classifyIntent(userInput: string): IntentClassification {
  const input = userInput.toLowerCase();

  const propertySearchPatterns = [
    /(?:find|search|looking for|want|need|ابحث|أبحث|ابي|ادور).{0,30}(?:apartment|villa|house|property|شقة|فيلا|عقار|بيت)/i,
    /(?:show|اعرض).{0,20}(?:properties|عقارات)/i,
    /\d\s*(?:bed|bedroom|غرف)/i,
    /(?:budget|ميزانية).{0,10}\d/i,
  ];

  const propertyDetailsPatterns = [
    /(?:more|تفاصيل|مزيد).{0,20}(?:details|info|information)/i,
    /(?:second|الثاني|third|الثالث).{0,10}(?:one|property|عقار)/i,
    /(?:this|هذا).{0,10}(?:property|عقار|شقة)/i,
    /(?:tell me more|اخبرني المزيد)/i,
  ];

  const financingPatterns = [
    /(?:loan|mortgage|financing|قرض|تمويل|رهن)/i,
    /(?:bank|بنك).{0,20}(?:product|offer|عرض)/i,
    /(?:finance|موّل).{0,20}(?:this|هذا)/i,
  ];

  const handoffPatterns = [
    /(?:speak|talk|اتصل|كلم).{0,20}(?:human|agent|شخص|موظف)/i,
    /(?:transfer|حولني).{0,20}(?:sales|المبيعات)/i,
  ];

  let maxScore = 0;
  let detectedIntent: IntentType = "general";

  for (const pattern of propertySearchPatterns) {
    if (pattern.test(input)) {
      const score = 0.9;
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = "property_search";
      }
    }
  }

  for (const pattern of propertyDetailsPatterns) {
    if (pattern.test(input)) {
      const score = 0.85;
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = "property_details";
      }
    }
  }

  for (const pattern of financingPatterns) {
    if (pattern.test(input)) {
      const score = 0.85;
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = "financing";
      }
    }
  }

  for (const pattern of handoffPatterns) {
    if (pattern.test(input)) {
      const score = 0.9;
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = "handoff";
      }
    }
  }

  const entities = extractEntities(userInput);

  let suggestedWorkflow: WorkflowDefinition | null = null;
  switch (detectedIntent) {
    case "property_search":
      suggestedWorkflow = PROPERTY_SEARCH_WORKFLOW;
      break;
    case "property_details":
      suggestedWorkflow = PROPERTY_DETAILS_WORKFLOW;
      break;
    case "financing":
      suggestedWorkflow = FINANCING_WORKFLOW;
      break;
  }

  return {
    intent: detectedIntent,
    confidence: maxScore || 0.5,
    entities,
    suggestedWorkflow,
  };
}

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
