/**
 * Context Prioritizer - Builds optimized context within token budget.
 * Priority: Constraints > Search State > Market > Conversation > General
 */

export const PRIORITY_WEIGHTS = {
  user_constraints: 1.0,
  current_search_state: 0.9,
  market_context: 0.7,
  conversation_history: 0.5,
  general_knowledge: 0.3,
} as const;

export const DEFAULT_MAX_TOKENS = 4000;
const AVG_CHARS_PER_TOKEN = 4;

export interface ContextLayer {
  content: string;
  priority: number;
  category: keyof typeof PRIORITY_WEIGHTS;
}

export interface UserConstraints {
  budget?: number | null;
  location?: string | null;
  minBeds?: number | null;
  maxBeds?: number | null;
  propertyType?: string | null;
  timeline?: string | null;
}

export interface SearchState {
  query?: string | null;
  resultsCount?: number;
  filters?: Record<string, unknown>;
  lastSearchAt?: number;
}

export interface MemoryContext {
  preferences: Array<{ key: string; value: string; confidence?: number }>;
  constraints: Array<{ key: string; value: string; confidence?: number }>;
  recentInteractions: Array<{
    key: string;
    value: string;
    entityType?: string;
  }>;
  summary: string;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

export function formatConstraints(constraints: UserConstraints): string {
  const parts: string[] = [];

  if (constraints.budget) {
    parts.push(`Budget: up to ${constraints.budget.toLocaleString()} SAR`);
  }
  if (constraints.location) {
    parts.push(`Location: ${constraints.location}`);
  }
  if (constraints.minBeds) {
    parts.push(`Minimum bedrooms: ${constraints.minBeds}`);
  }
  if (constraints.maxBeds) {
    parts.push(`Maximum bedrooms: ${constraints.maxBeds}`);
  }
  if (constraints.propertyType) {
    parts.push(`Property type: ${constraints.propertyType}`);
  }
  if (constraints.timeline) {
    parts.push(`Timeline: ${constraints.timeline}`);
  }

  return parts.length > 0
    ? `User Requirements:\n${parts.map((p) => `- ${p}`).join("\n")}`
    : "";
}

export function formatSearchState(state: SearchState): string {
  const parts: string[] = [];

  if (state.query) {
    parts.push(`Current search: "${state.query}"`);
  }
  if (state.resultsCount !== undefined) {
    parts.push(`Results found: ${state.resultsCount}`);
  }
  if (state.filters && Object.keys(state.filters).length > 0) {
    const filterStrings = Object.entries(state.filters)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(", ");
    parts.push(`Active filters: ${filterStrings}`);
  }

  return parts.length > 0
    ? `Search Context:\n${parts.map((p) => `- ${p}`).join("\n")}`
    : "";
}

export function formatMemoryContext(memory: MemoryContext): string {
  const parts: string[] = [];

  if (memory.preferences.length > 0) {
    const prefs = memory.preferences
      .slice(0, 5)
      .map((p) => `- ${p.key}: ${p.value}`)
      .join("\n");
    parts.push(`Known Preferences:\n${prefs}`);
  }

  if (memory.constraints.length > 0) {
    const consts = memory.constraints
      .slice(0, 5)
      .map((c) => `- ${c.key}: ${c.value}`)
      .join("\n");
    parts.push(`Constraints:\n${consts}`);
  }

  return parts.join("\n\n");
}

export function formatConversationSummary(
  messages: Array<{ role: string; content: string }>,
): string {
  if (messages.length === 0) return "";

  const recentMessages = messages.slice(-10);
  const summary = recentMessages
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 200)}`,
    )
    .join("\n");

  return `Recent Conversation:\n${summary}`;
}

export function prioritizeAndCompress(
  layers: ContextLayer[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
): string {
  const sortedLayers = [...layers].sort((a, b) => b.priority - a.priority);

  let budget = maxTokens;
  const selected: string[] = [];

  for (const layer of sortedLayers) {
    const tokens = estimateTokens(layer.content);

    if (tokens <= budget) {
      selected.push(layer.content);
      budget -= tokens;
    } else if (budget > 100) {
      const truncated = truncateContent(layer.content, budget);
      selected.push(truncated);
      budget = 0;
      break;
    }
  }

  return selected.join("\n\n");
}

export function truncateContent(content: string, maxTokens: number): string {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
  if (content.length <= maxChars) return content;

  const truncated = content.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");
  const lastPeriod = truncated.lastIndexOf(".");
  const cutPoint = Math.max(lastNewline, lastPeriod, maxChars - 100);

  return `${truncated.slice(0, cutPoint)}...`;
}

export function buildPrioritizedContext(
  memory: MemoryContext,
  searchState: SearchState,
  conversation: Array<{ role: string; content: string }> = [],
  maxTokens: number = DEFAULT_MAX_TOKENS,
): string {
  const layers: ContextLayer[] = [];

  const constraintText = formatMemoryContext(memory);
  if (constraintText) {
    layers.push({
      content: constraintText,
      priority: PRIORITY_WEIGHTS.user_constraints,
      category: "user_constraints",
    });
  }

  const searchStateText = formatSearchState(searchState);
  if (searchStateText) {
    layers.push({
      content: searchStateText,
      priority: PRIORITY_WEIGHTS.current_search_state,
      category: "current_search_state",
    });
  }

  const conversationText = formatConversationSummary(conversation);
  if (conversationText) {
    layers.push({
      content: conversationText,
      priority: PRIORITY_WEIGHTS.conversation_history,
      category: "conversation_history",
    });
  }

  return prioritizeAndCompress(layers, maxTokens);
}

export function extractKeyFacts(
  conversation: Array<{ role: string; content: string }>,
): Array<{
  key: string;
  value: string;
  confidence: number;
}> {
  const facts: Array<{ key: string; value: string; confidence: number }> = [];
  const budgetPattern = /(?:budget|ميزانية|بودج).{0,20}(\d{4,9})/i;
  const locationPattern =
    /(?:in|at|في|بحي).{0,20}([A-Za-z\u0600-\u06FF]{3,20})/i;
  const bedsPattern = /(\d+)\s*(?:bed|bedroom|غرف|غرفة)/i;

  for (const msg of conversation) {
    if (msg.role !== "user") continue;

    const budgetMatch = msg.content.match(budgetPattern);
    if (budgetMatch) {
      facts.push({
        key: "budget_preference",
        value: budgetMatch[1],
        confidence: 0.7,
      });
    }

    const locationMatch = msg.content.match(locationPattern);
    if (locationMatch) {
      facts.push({
        key: `location_preference_${locationMatch[1].toLowerCase()}`,
        value: locationMatch[1],
        confidence: 0.6,
      });
    }

    const bedsMatch = msg.content.match(bedsPattern);
    if (bedsMatch) {
      facts.push({
        key: "beds_preference",
        value: bedsMatch[1],
        confidence: 0.7,
      });
    }
  }

  return facts;
}

export function mergeContexts(
  existing: MemoryContext,
  newFacts: Array<{ key: string; value: string; confidence: number }>,
): MemoryContext {
  const mergedPreferences = [...existing.preferences];
  const mergedConstraints = [...existing.constraints];

  for (const fact of newFacts) {
    const existingIdx = mergedPreferences.findIndex((p) => p.key === fact.key);

    if (existingIdx >= 0) {
      if (fact.confidence > (mergedPreferences[existingIdx].confidence ?? 0)) {
        mergedPreferences[existingIdx] = {
          key: fact.key,
          value: fact.value,
          confidence: fact.confidence,
        };
      }
    } else {
      mergedPreferences.push({
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence,
      });
    }
  }

  return {
    ...existing,
    preferences: mergedPreferences,
    constraints: mergedConstraints,
  };
}
