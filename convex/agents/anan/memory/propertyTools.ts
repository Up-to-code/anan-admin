/**
 * Memory-aware property tools - Enhanced property tools with memory integration.
 */
import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { toonEncode } from "../../../lib/toon";
import type { AgentToolsApi } from "../tools/types";
import {
  extractKeyFacts,
  formatConstraints,
  type UserConstraints,
} from "../context/prioritizer";
import type { FunctionReference } from "convex/server";

type MemoryApi = {
  store: FunctionReference<"mutation", "public">;
  storeInteraction: FunctionReference<"mutation", "public">;
  storeEntityRelation: FunctionReference<"mutation", "public">;
  getRelevantContext: FunctionReference<"query", "public">;
};

type RunQuery = (
  ref: FunctionReference<"query", "public">,
  args: Record<string, unknown>,
) => Promise<unknown>;
type RunMutation = (
  ref: FunctionReference<"mutation", "public">,
  args: Record<string, unknown>,
) => Promise<unknown>;

interface MemoryContext {
  preferences: Array<{ key: string; value: string; confidence?: number }>;
  constraints: Array<{ key: string; value: string; confidence?: number }>;
  recentInteractions: Array<{
    key: string;
    value: string;
    entityType?: string;
  }>;
  summary: string;
}

function getContextUser(ctx: unknown): {
  userId?: string;
  channel?: "whatsapp" | "app" | "web";
} {
  const userId = (ctx as { userId?: string }).userId;
  const channel = (ctx as { channel?: "whatsapp" | "app" | "web" }).channel;
  return { userId, channel };
}

function parseMemoryToConstraints(memory: MemoryContext): UserConstraints {
  const constraints: UserConstraints = {};

  for (const pref of memory.preferences) {
    if (pref.key === "budget_preference") {
      constraints.budget = parseInt(pref.value, 10);
    } else if (pref.key.startsWith("location_preference_")) {
      constraints.location = pref.value;
    } else if (pref.key === "property_type_preference") {
      constraints.propertyType = pref.value;
    } else if (
      pref.key === "min_beds_constraint" ||
      pref.key === "beds_preference"
    ) {
      constraints.minBeds = parseInt(pref.value, 10);
    }
  }

  for (const c of memory.constraints) {
    if (c.key === "budget_preference" || c.key === "budget") {
      constraints.budget = parseInt(c.value, 10);
    } else if (c.key === "min_beds_constraint") {
      constraints.minBeds = parseInt(c.value, 10);
    }
  }

  return constraints;
}

function enrichQueryWithMemory(
  query: string,
  constraints: UserConstraints,
): string {
  const parts: string[] = [query];

  if (constraints.budget && !query.match(/\d{4,9}/)) {
    parts.push(`budget ${constraints.budget}`);
  }
  if (
    constraints.location &&
    !query.toLowerCase().includes(constraints.location.toLowerCase())
  ) {
    parts.push(constraints.location);
  }
  if (constraints.minBeds && !query.match(/bed|غرف/i)) {
    parts.push(`${constraints.minBeds} bedrooms`);
  }
  if (
    constraints.propertyType &&
    !query.toLowerCase().includes(constraints.propertyType.toLowerCase())
  ) {
    parts.push(constraints.propertyType);
  }

  return parts.join(" ");
}

function extractPropertyEntities(result: {
  title?: string;
  locationHint?: string;
  priceHint?: string;
  beds?: string;
  propertyUrl?: string;
}): Array<{ type: string; id: string; data?: Record<string, unknown> }> {
  const entities: Array<{
    type: string;
    id: string;
    data?: Record<string, unknown>;
  }> = [];

  if (result.propertyUrl) {
    entities.push({
      type: "property",
      id: result.propertyUrl,
      data: {
        title: result.title,
        price: result.priceHint,
        beds: result.beds,
      },
    });
  }

  if (result.locationHint) {
    entities.push({
      type: "location",
      id: result.locationHint.toLowerCase().replace(/\s+/g, "_"),
      data: { name: result.locationHint },
    });
  }

  return entities;
}

export function createMemoryAwarePropertyTools(
  appApi: AgentToolsApi,
  memoryApi: MemoryApi,
) {
  const getMemoryContext = createTool({
    description:
      "Retrieve user's stored preferences and constraints from memory. Use at the start of a conversation or before searching to personalize results.",
    args: z.object({
      query: z
        .string()
        .optional()
        .describe("Current query to find relevant context"),
    }),
    handler: async (ctx, { query }) => {
      const { userId } = getContextUser(ctx);
      if (!userId) {
        return toonEncode({
          preferences: [],
          constraints: [],
          recentInteractions: [],
          summary: "No user context available.",
        });
      }

      const runQuery = (ctx as { runQuery?: RunQuery }).runQuery;
      if (typeof runQuery !== "function") {
        return toonEncode({
          preferences: [],
          constraints: [],
          recentInteractions: [],
          summary: "Memory service unavailable.",
        });
      }

      const memory = await runQuery(memoryApi.getRelevantContext, {
        userId,
        query: query ?? "",
      });

      return toonEncode(memory);
    },
  });

  const storeUserPreference = createTool({
    description:
      "Store a user preference or constraint in long-term memory. Use when user explicitly states a preference or you infer one from their search.",
    args: z.object({
      key: z
        .string()
        .describe(
          "Preference key (e.g., budget_preference, location_preference)",
        ),
      value: z.string().describe("Preference value"),
      confidence: z.number().min(0).max(1).optional().default(0.8),
      source: z
        .enum(["explicit", "inferred_from_search", "inferred_from_feedback"])
        .optional(),
    }),
    handler: async (ctx, { key, value, confidence, source }) => {
      const { userId } = getContextUser(ctx);
      if (!userId) return toonEncode({ success: false, reason: "No user ID" });

      const runMutation = (ctx as { runMutation?: RunMutation }).runMutation;
      if (typeof runMutation !== "function") {
        return toonEncode({
          success: false,
          reason: "Memory service unavailable",
        });
      }

      await runMutation(memoryApi.store, {
        userId,
        memoryType: key.includes("constraint") ? "constraint" : "preference",
        key,
        value,
        confidence,
        source: source ?? "inferred_from_search",
      });

      return toonEncode({ success: true, key, value });
    },
  });

  const trackPropertyInteraction = createTool({
    description:
      "Track user interaction with a property (view, like, inquire). Creates memory record and entity relations for future recommendations.",
    args: z.object({
      propertyUrl: z.string(),
      propertyTitle: z.string(),
      action: z.enum(["viewed", "liked", "inquired", "passed"]),
      location: z.string().optional(),
      price: z.string().optional(),
    }),
    handler: async (
      ctx,
      { propertyUrl, propertyTitle, action, location, price },
    ) => {
      const { userId, channel } = getContextUser(ctx);
      if (!userId) return toonEncode({ success: false });

      const runMutation = (ctx as { runMutation?: RunMutation }).runMutation;
      if (typeof runMutation !== "function") {
        return toonEncode({ success: false });
      }

      await runMutation(memoryApi.storeInteraction, {
        userId,
        entityType: "property",
        entityId: propertyUrl,
        action,
        details: JSON.stringify({ title: propertyTitle, price }),
        metadata: { channel },
      });

      await runMutation(memoryApi.storeEntityRelation, {
        fromType: "user",
        fromId: userId,
        relationType: action.toUpperCase(),
        toType: "property",
        toId: propertyUrl,
        userId,
        strength: action === "liked" ? 0.9 : action === "inquired" ? 0.8 : 0.5,
      });

      if (location) {
        await runMutation(memoryApi.storeEntityRelation, {
          fromType: "property",
          fromId: propertyUrl,
          relationType: "LOCATED_IN",
          toType: "location",
          toId: location.toLowerCase().replace(/\s+/g, "_"),
          userId,
        });

        await runMutation(memoryApi.storeEntityRelation, {
          fromType: "user",
          fromId: userId,
          relationType: "SEARCHED_IN",
          toType: "location",
          toId: location.toLowerCase().replace(/\s+/g, "_"),
          userId,
        });
      }

      return toonEncode({ success: true });
    },
  });

  const getSimilarPropertiesFromMemory = createTool({
    description:
      "Find properties the user has previously shown interest in. Use for personalized recommendations and 'similar to what you liked' suggestions.",
    args: z.object({
      limit: z.number().optional().default(5),
    }),
    handler: async (ctx, { limit }) => {
      const { userId } = getContextUser(ctx);
      if (!userId) return toonEncode({ properties: [] });

      const runQuery = (ctx as { runQuery?: RunQuery }).runQuery;
      if (typeof runQuery !== "function") {
        return toonEncode({ properties: [] });
      }

      const interactions = (await runQuery(memoryApi.getRelevantContext, {
        userId,
        query: "property interaction",
      })) as MemoryContext;

      const propertyInteractions = interactions.recentInteractions
        .filter((i: { entityType?: string }) => i.entityType === "property")
        .slice(0, limit);

      return toonEncode({ properties: propertyInteractions });
    },
  });

  return {
    getMemoryContext,
    storeUserPreference,
    trackPropertyInteraction,
    getSimilarPropertiesFromMemory,
  };
}

export function enrichSearchQuery(
  query: string,
  memory: MemoryContext | null,
): {
  enrichedQuery: string;
  constraints: UserConstraints;
  constraintHint: string;
} {
  const constraints = memory ? parseMemoryToConstraints(memory) : {};
  const enrichedQuery = memory
    ? enrichQueryWithMemory(query, constraints)
    : query;
  const constraintHint =
    Object.keys(constraints).length > 0 ? formatConstraints(constraints) : "";

  return { enrichedQuery, constraints, constraintHint };
}

export async function storeSearchInsights(
  ctx: unknown,
  memoryApi: MemoryApi,
  userId: string | undefined,
  query: string,
  results: Array<{
    title?: string;
    locationHint?: string;
    priceHint?: string;
    beds?: string;
    propertyUrl?: string;
  }>,
): Promise<void> {
  if (!userId) return;

  const runMutation = (ctx as { runMutation?: RunMutation }).runMutation;
  if (typeof runMutation !== "function") return;

  const facts = extractKeyFacts([{ role: "user", content: query }]);

  for (const fact of facts) {
    try {
      await runMutation(memoryApi.store, {
        userId,
        memoryType: "preference",
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence,
        source: "inferred_from_search",
      });
    } catch {
      // Ignore storage errors
    }
  }

  const locations = new Set<string>();
  for (const result of results) {
    if (result.locationHint) {
      locations.add(result.locationHint);
    }

    const entities = extractPropertyEntities(result);
    for (const entity of entities) {
      try {
        await runMutation(memoryApi.storeEntityRelation, {
          fromType: "user",
          fromId: userId,
          relationType: "VIEWED",
          toType: entity.type,
          toId: entity.id,
          userId,
          strength: 0.3,
        });
      } catch {
        // Ignore relation errors
      }
    }
  }

  for (const location of locations) {
    try {
      await runMutation(memoryApi.store, {
        userId,
        memoryType: "preference",
        key: `location_interest_${location.toLowerCase().replace(/\s+/g, "_")}`,
        value: location,
        confidence: 0.5,
        source: "inferred_from_search",
      });
    } catch {
      // Ignore storage errors
    }
  }
}
