/**
 * Tool Registry - Metadata-driven tool selection for the orchestrator.
 */
import type { IntentType } from "../orchestrator";

export interface ToolMetadata {
  name: string;
  description: string;
  capabilities: string[];
  inputSchema: Record<
    string,
    { type: string; required: boolean; description: string }
  >;
  outputType: string;
  cacheTTL: number;
  priority: number;
  rateLimit?: number;
  dependencies?: string[];
  applicableIntents: IntentType[];
}

export const TOOL_REGISTRY: ToolMetadata[] = [
  {
    name: "smartPropertySearch",
    description:
      "Property-intent search service with DB-first and web fallback",
    capabilities: [
      "property_search",
      "location_filter",
      "price_filter",
      "beds_filter",
    ],
    inputSchema: {
      query: { type: "string", required: true, description: "Search query" },
      limit: { type: "number", required: false, description: "Max results" },
      refreshToken: {
        type: "string",
        required: false,
        description: "For refresh searches",
      },
    },
    outputType: "PropertySearchResult",
    cacheTTL: 300000,
    priority: 1,
    rateLimit: 100,
    applicableIntents: ["property_search"],
  },
  {
    name: "getLastSearchContext",
    description: "Get the last property search context for follow-up queries",
    capabilities: ["context_retrieval", "search_history"],
    inputSchema: {},
    outputType: "SearchContext",
    cacheTTL: 0,
    priority: 2,
    applicableIntents: ["property_search", "property_details"],
  },
  {
    name: "getLastSearchFindings",
    description: "Get the list of properties from the last search",
    capabilities: ["context_retrieval", "property_list"],
    inputSchema: {
      maxFindings: {
        type: "number",
        required: false,
        description: "Max findings to return",
      },
    },
    outputType: "SearchFindings",
    cacheTTL: 0,
    priority: 2,
    applicableIntents: ["property_details"],
  },
  {
    name: "getMoreDetailsForProperty",
    description: "Fetch richer details for a specific property by URL or title",
    capabilities: ["property_details", "web_fetch"],
    inputSchema: {
      propertyUrl: {
        type: "string",
        required: true,
        description: "Property URL",
      },
      title: { type: "string", required: false, description: "Property title" },
    },
    outputType: "PropertyDetails",
    cacheTTL: 600000,
    priority: 1,
    rateLimit: 50,
    applicableIntents: ["property_details"],
  },
  {
    name: "getMemoryContext",
    description:
      "Retrieve user's stored preferences and constraints from memory",
    capabilities: ["memory_retrieval", "personalization"],
    inputSchema: {
      query: {
        type: "string",
        required: false,
        description: "Current query for context",
      },
    },
    outputType: "MemoryContext",
    cacheTTL: 0,
    priority: 1,
    dependencies: ["memory"],
    applicableIntents: ["property_search", "financing", "general"],
  },
  {
    name: "storeUserPreference",
    description: "Store a user preference or constraint in long-term memory",
    capabilities: ["memory_storage", "learning"],
    inputSchema: {
      key: { type: "string", required: true, description: "Preference key" },
      value: {
        type: "string",
        required: true,
        description: "Preference value",
      },
      confidence: {
        type: "number",
        required: false,
        description: "Confidence 0-1",
      },
    },
    outputType: "StorageResult",
    cacheTTL: 0,
    priority: 3,
    dependencies: ["memory"],
    applicableIntents: ["property_search", "property_details"],
  },
  {
    name: "trackPropertyInteraction",
    description: "Track user interaction with a property",
    capabilities: ["interaction_tracking", "analytics"],
    inputSchema: {
      propertyUrl: {
        type: "string",
        required: true,
        description: "Property URL",
      },
      propertyTitle: {
        type: "string",
        required: true,
        description: "Property title",
      },
      action: {
        type: "string",
        required: true,
        description: "viewed/liked/inquired/passed",
      },
    },
    outputType: "TrackingResult",
    cacheTTL: 0,
    priority: 3,
    dependencies: ["memory"],
    applicableIntents: ["property_details"],
  },
  {
    name: "getKnowledgePage",
    description: "Get a knowledge/FAQ page by slug",
    capabilities: ["knowledge_retrieval", "faq"],
    inputSchema: {
      slug: { type: "string", required: true, description: "Page slug" },
    },
    outputType: "KnowledgePage",
    cacheTTL: 3600000,
    priority: 2,
    applicableIntents: ["financing", "general"],
  },
  {
    name: "getBundles",
    description: "Get bank bundles and products",
    capabilities: ["bank_products", "financing"],
    inputSchema: {},
    outputType: "BankBundles",
    cacheTTL: 3600000,
    priority: 2,
    applicableIntents: ["financing"],
  },
  {
    name: "getById",
    description: "Get bank by ID",
    capabilities: ["bank_details"],
    inputSchema: {
      bankId: { type: "string", required: true, description: "Bank ID" },
    },
    outputType: "Bank",
    cacheTTL: 3600000,
    priority: 2,
    applicableIntents: ["financing"],
  },
  {
    name: "getByUserId",
    description: "Get user profile",
    capabilities: ["user_profile", "personalization"],
    inputSchema: {
      userId: { type: "string", required: true, description: "User ID" },
    },
    outputType: "UserProfile",
    cacheTTL: 60000,
    priority: 2,
    applicableIntents: ["property_search", "financing"],
  },
  {
    name: "createHandoff",
    description: "Create a handoff request to human sales team",
    capabilities: ["handoff", "escalation"],
    inputSchema: {
      intent: { type: "string", required: true, description: "Handoff intent" },
      summary: {
        type: "string",
        required: false,
        description: "Conversation summary",
      },
    },
    outputType: "HandoffResult",
    cacheTTL: 0,
    priority: 1,
    applicableIntents: ["handoff"],
  },
];

export function selectToolsForIntent(intent: IntentType): ToolMetadata[] {
  return TOOL_REGISTRY.filter((tool) =>
    tool.applicableIntents.includes(intent),
  ).sort((a, b) => a.priority - b.priority);
}

export function getToolByName(name: string): ToolMetadata | undefined {
  return TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function getToolsByCapability(capability: string): ToolMetadata[] {
  return TOOL_REGISTRY.filter((tool) => tool.capabilities.includes(capability));
}

export function resolveToolDependencies(toolName: string): string[] {
  const tool = getToolByName(toolName);
  if (!tool?.dependencies) return [];

  const allDeps: string[] = [...tool.dependencies];
  for (const dep of tool.dependencies) {
    const depTools = TOOL_REGISTRY.filter((t) => t.capabilities.includes(dep));
    for (const depTool of depTools) {
      if (!allDeps.includes(depTool.name)) {
        allDeps.push(depTool.name);
      }
    }
  }

  return allDeps;
}

export interface ToolSelectionResult {
  primaryTool: ToolMetadata;
  supportingTools: ToolMetadata[];
  executionOrder: string[];
}

export function planToolExecution(
  intent: IntentType,
  _userInput: string,
): ToolSelectionResult | null {
  const tools = selectToolsForIntent(intent);
  if (tools.length === 0) return null;

  const primaryTool = tools[0];
  const supportingTools = tools.slice(1);

  const executionOrder: string[] = [];

  const memoryTools = tools.filter(
    (t) =>
      t.capabilities.includes("memory_retrieval") ||
      t.capabilities.includes("context_retrieval"),
  );
  for (const t of memoryTools) {
    executionOrder.push(t.name);
  }

  executionOrder.push(primaryTool.name);

  const storageTools = tools.filter(
    (t) =>
      t.capabilities.includes("memory_storage") ||
      t.capabilities.includes("interaction_tracking"),
  );
  for (const t of storageTools) {
    if (!executionOrder.includes(t.name)) {
      executionOrder.push(t.name);
    }
  }

  return {
    primaryTool,
    supportingTools,
    executionOrder,
  };
}

export function getToolCacheKey(
  toolName: string,
  params: Record<string, unknown>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&");
  return `${toolName}:${sortedParams}`;
}
