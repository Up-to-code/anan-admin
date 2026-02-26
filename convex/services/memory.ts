/**
 * Agent Memory Service - Cross-session persistence for user preferences, facts, and interactions.
 * Implements three-tier memory architecture: working (session), long-term (preferences), knowledge graph.
 */
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { optionalAuth, requireAdmin } from "../lib/auth";

export type MemoryType =
  | "preference"
  | "fact"
  | "interaction"
  | "constraint"
  | "feedback";
export type EntityType =
  | "property"
  | "location"
  | "bank"
  | "product"
  | "neighborhood";

const MEMORY_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const MEMORY_HIGH_CONFIDENCE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export const store = mutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    memoryType: v.union(
      v.literal("preference"),
      v.literal("fact"),
      v.literal("interaction"),
      v.literal("constraint"),
      v.literal("feedback"),
    ),
    entityType: v.optional(
      v.union(
        v.literal("property"),
        v.literal("location"),
        v.literal("bank"),
        v.literal("product"),
        v.literal("neighborhood"),
      ),
    ),
    entityId: v.optional(v.string()),
    key: v.string(),
    value: v.string(),
    confidence: v.optional(v.number()),
    source: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("agentMemory"),
  handler: async (ctx, args) => {
    const authUserId = await optionalAuth(ctx);
    if (authUserId !== args.userId) {
      await requireAdmin(ctx);
    }
    const now = Date.now();
    const confidence = args.confidence ?? 0.8;
    const expiresAt =
      args.expiresAt ??
      (confidence >= 0.9
        ? now + MEMORY_HIGH_CONFIDENCE_TTL_MS
        : now + MEMORY_DEFAULT_TTL_MS);

    const existing = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key),
      )
      .first();

    if (existing && existing.memoryType === args.memoryType) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        confidence: Math.max(existing.confidence ?? 0, confidence),
        expiresAt,
        metadata: args.metadata,
        threadId: args.threadId ?? existing.threadId,
      });
      return existing._id;
    }

    return ctx.db.insert("agentMemory", {
      ...args,
      confidence,
      expiresAt,
    });
  },
});

/**
 * Store a search summary in agent memory after successful smartPropertySearch.
 * Used so REMEMBERED USER CONTEXT can include "recently searched for X in Y".
 */
export const storeSearchSummaryInternal = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    query: v.string(),
    locationHint: v.optional(v.string()),
    budgetHint: v.optional(v.string()),
    findingsCount: v.number(),
  },
  returns: v.id("agentMemory"),
  handler: async (ctx, args) => {
    const value = JSON.stringify({
      query: args.query,
      location: args.locationHint ?? null,
      budgetHint: args.budgetHint ?? null,
      findingsCount: args.findingsCount,
      timestamp: Date.now(),
    });
    const now = Date.now();
    const expiresAt = now + MEMORY_DEFAULT_TTL_MS;
    const existing = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_key", (q) =>
        q.eq("userId", args.userId).eq("key", "last_search_summary"),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        expiresAt,
        threadId: args.threadId ?? existing.threadId,
      });
      return existing._id;
    }
    return ctx.db.insert("agentMemory", {
      userId: args.userId,
      threadId: args.threadId,
      memoryType: "fact",
      key: "last_search_summary",
      value,
      confidence: 0.9,
      source: "property_search",
      expiresAt,
    });
  },
});

/** Internal: same as store but no auth. For Mastra tools invoked from backend. */
export const storeInternal = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    memoryType: v.union(
      v.literal("preference"),
      v.literal("fact"),
      v.literal("interaction"),
      v.literal("constraint"),
      v.literal("feedback"),
    ),
    entityType: v.optional(
      v.union(
        v.literal("property"),
        v.literal("location"),
        v.literal("bank"),
        v.literal("product"),
        v.literal("neighborhood"),
      ),
    ),
    entityId: v.optional(v.string()),
    key: v.string(),
    value: v.string(),
    confidence: v.optional(v.number()),
    source: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("agentMemory"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const confidence = args.confidence ?? 0.8;
    const expiresAt =
      args.expiresAt ??
      (confidence >= 0.9
        ? now + MEMORY_HIGH_CONFIDENCE_TTL_MS
        : now + MEMORY_DEFAULT_TTL_MS);

    const existing = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key),
      )
      .first();

    if (existing && existing.memoryType === args.memoryType) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        confidence: Math.max(existing.confidence ?? 0, confidence),
        expiresAt,
        metadata: args.metadata,
        threadId: args.threadId ?? existing.threadId,
      });
      return existing._id;
    }

    return ctx.db.insert("agentMemory", {
      ...args,
      confidence,
      expiresAt,
    });
  },
});

export const storeWithEmbedding = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    memoryType: v.union(
      v.literal("preference"),
      v.literal("fact"),
      v.literal("interaction"),
      v.literal("constraint"),
      v.literal("feedback"),
    ),
    entityType: v.optional(
      v.union(
        v.literal("property"),
        v.literal("location"),
        v.literal("bank"),
        v.literal("product"),
        v.literal("neighborhood"),
      ),
    ),
    entityId: v.optional(v.string()),
    key: v.string(),
    value: v.string(),
    confidence: v.optional(v.number()),
    source: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    embedding: v.array(v.float64()),
  },
  returns: v.id("agentMemory"),
  handler: async (ctx, args) => {
    const { embedding, ...memoryArgs } = args;
    const now = Date.now();
    const confidence = args.confidence ?? 0.8;
    const expiresAt =
      args.expiresAt ??
      (confidence >= 0.9
        ? now + MEMORY_HIGH_CONFIDENCE_TTL_MS
        : now + MEMORY_DEFAULT_TTL_MS);

    const memoryId = await ctx.db.insert("agentMemory", {
      ...memoryArgs,
      confidence,
      expiresAt,
    });

    await ctx.db.insert("agentMemoryEmbeddings", {
      memoryId,
      embedding,
    });

    const embeddingRecord = await ctx.db
      .query("agentMemoryEmbeddings")
      .withIndex("by_memoryId", (q) => q.eq("memoryId", memoryId))
      .first();

    if (embeddingRecord) {
      await ctx.db.patch(memoryId, { embeddingId: embeddingRecord._id });
    }

    return memoryId;
  },
});

export const retrieve = query({
  args: {
    userId: v.string(),
    memoryType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("fact"),
        v.literal("interaction"),
        v.literal("constraint"),
        v.literal("feedback"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, { userId, memoryType, limit = 20 }) => {
    const authUserId = await optionalAuth(ctx);
    if (authUserId !== userId) {
      await requireAdmin(ctx);
    }
    const now = Date.now();
    const queryResult = ctx.db
      .query("agentMemory")
      .withIndex("userId", (q) => q.eq("userId", userId));

    const results = await queryResult.collect();

    return results
      .filter((r) => !r.expiresAt || r.expiresAt > now)
      .filter((r) => !memoryType || r.memoryType === memoryType)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, limit);
  },
});

export const getByKey = query({
  args: {
    userId: v.string(),
    key: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { userId, key }) => {
    const authUserId = await optionalAuth(ctx);
    if (authUserId !== userId) {
      await requireAdmin(ctx);
    }
    const now = Date.now();
    const memory = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_key", (q) => q.eq("userId", userId).eq("key", key))
      .first();

    if (!memory) return null;
    if (memory.expiresAt && memory.expiresAt <= now) return null;
    return memory;
  },
});

export const getRelevantContext = query({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    preferences: v.array(v.any()),
    constraints: v.array(v.any()),
    recentInteractions: v.array(v.any()),
    summary: v.string(),
  }),
  handler: async (ctx, { userId, limit = 10 }) => {
    const authUserId = await optionalAuth(ctx);
    if (authUserId !== userId) {
      try {
        await requireAdmin(ctx);
      } catch {
        // No auth (e.g. query run from action context): return empty, do not leak data
        return {
          preferences: [],
          constraints: [],
          recentInteractions: [],
          summary: "",
        };
      }
    }
    const now = Date.now();

    const preferences = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "preference"),
      )
      .collect()
      .then((results) =>
        results
          .filter((r) => !r.expiresAt || r.expiresAt > now)
          .slice(0, limit),
      );

    const constraints = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "constraint"),
      )
      .collect()
      .then((results) =>
        results
          .filter((r) => !r.expiresAt || r.expiresAt > now)
          .slice(0, limit),
      );

    const interactions = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "interaction"),
      )
      .order("desc")
      .collect()
      .then((results) =>
        results.filter((r) => !r.expiresAt || r.expiresAt > now).slice(0, 5),
      );

    const summary = buildMemorySummary(preferences, constraints, interactions);

    return {
      preferences,
      constraints,
      recentInteractions: interactions,
      summary,
    };
  },
});

/**
 * Multi-strategy memory: key-based + type-based recall.
 * Semantic search deferred (no vector index in schema yet).
 * Used for REMEMBERED USER CONTEXT injection in agent actions.
 */
export const getRelevantMemoriesByQuery = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    preferences: v.array(v.any()),
    constraints: v.array(v.any()),
    recentInteractions: v.array(v.any()),
    lastSearchSummary: v.union(v.null(), v.any()),
    summary: v.string(),
  }),
  handler: async (ctx, { userId, limit = 10 }) => {
    const now = Date.now();

    const preferences = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "preference"),
      )
      .collect()
      .then((results) =>
        results
          .filter((r) => !r.expiresAt || r.expiresAt > now)
          .slice(0, limit),
      );

    const constraints = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "constraint"),
      )
      .collect()
      .then((results) =>
        results
          .filter((r) => !r.expiresAt || r.expiresAt > now)
          .slice(0, limit),
      );

    const interactions = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "interaction"),
      )
      .order("desc")
      .collect()
      .then((results) =>
        results.filter((r) => !r.expiresAt || r.expiresAt > now).slice(0, 5),
      );

    const lastSearchSummary = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_key", (q) =>
        q.eq("userId", userId).eq("key", "last_search_summary"),
      )
      .first()
      .then((r) => {
        if (!r || (r.expiresAt != null && r.expiresAt <= now)) return null;
        try {
          return JSON.parse(r.value) as {
            query: string;
            location: string | null;
            budgetHint: string | null;
            findingsCount: number;
          };
        } catch {
          return null;
        }
      });

    const summary = buildMemorySummary(
      preferences,
      constraints,
      interactions,
      lastSearchSummary,
    );

    return {
      preferences,
      constraints,
      recentInteractions: interactions,
      lastSearchSummary,
      summary,
    };
  },
});

export const getRelevantContextInternal = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    preferences: v.array(v.any()),
    constraints: v.array(v.any()),
    recentInteractions: v.array(v.any()),
    summary: v.string(),
  }),
  handler: async (ctx, { userId, limit = 10 }) => {
    const now = Date.now();

    const preferences = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "preference"),
      )
      .collect()
      .then((results) =>
        results
          .filter((r) => !r.expiresAt || r.expiresAt > now)
          .slice(0, limit),
      );

    const constraints = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "constraint"),
      )
      .collect()
      .then((results) =>
        results
          .filter((r) => !r.expiresAt || r.expiresAt > now)
          .slice(0, limit),
      );

    const interactions = await ctx.db
      .query("agentMemory")
      .withIndex("userId_and_memoryType", (q) =>
        q.eq("userId", userId).eq("memoryType", "interaction"),
      )
      .order("desc")
      .collect()
      .then((results) =>
        results.filter((r) => !r.expiresAt || r.expiresAt > now).slice(0, 5),
      );

    const summary = buildMemorySummary(preferences, constraints, interactions);

    return {
      preferences,
      constraints,
      recentInteractions: interactions,
      summary,
    };
  },
});

export const getMemoriesByEmbeddingIds = internalQuery({
  args: {
    embeddingIds: v.array(v.id("agentMemoryEmbeddings")),
  },
  returns: v.array(v.any()),
  handler: async (ctx, { embeddingIds }) => {
    const now = Date.now();
    const results: any[] = [];
    for (const id of embeddingIds) {
      const emb = await ctx.db.get(id);
      if (!emb) continue;
      const memory = await ctx.db.get(emb.memoryId);
      if (!memory) continue;
      if (memory.expiresAt != null && memory.expiresAt <= now) continue;
      results.push(memory);
    }
    return results;
  },
});

/** Internal: same as storeInteraction but no auth. For Mastra tools invoked from backend. */
export const storeInteractionInternal = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    entityType: v.optional(
      v.union(
        v.literal("property"),
        v.literal("location"),
        v.literal("bank"),
        v.literal("product"),
        v.literal("neighborhood"),
      ),
    ),
    entityId: v.optional(v.string()),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("agentMemory"),
  handler: async (ctx, args) => {
    const key = `interaction_${args.entityType ?? "general"}_${args.entityId ?? Date.now()}`;
    const value = JSON.stringify({
      action: args.action,
      details: args.details,
      timestamp: Date.now(),
    });

    return ctx.db.insert("agentMemory", {
      userId: args.userId,
      threadId: args.threadId,
      memoryType: "interaction",
      entityType: args.entityType,
      entityId: args.entityId,
      key,
      value,
      confidence: 1.0,
      source: "user_action",
      expiresAt: Date.now() + MEMORY_DEFAULT_TTL_MS,
      metadata: args.metadata,
    });
  },
});

export const storeInteraction = mutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    entityType: v.optional(
      v.union(
        v.literal("property"),
        v.literal("location"),
        v.literal("bank"),
        v.literal("product"),
        v.literal("neighborhood"),
      ),
    ),
    entityId: v.optional(v.string()),
    action: v.string(),
    details: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("agentMemory"),
  handler: async (ctx, args) => {
    const authUserId = await optionalAuth(ctx);
    if (authUserId !== args.userId) {
      await requireAdmin(ctx);
    }
    const key = `interaction_${args.entityType ?? "general"}_${args.entityId ?? Date.now()}`;
    const value = JSON.stringify({
      action: args.action,
      details: args.details,
      timestamp: Date.now(),
    });

    return ctx.db.insert("agentMemory", {
      userId: args.userId,
      threadId: args.threadId,
      memoryType: "interaction",
      entityType: args.entityType,
      entityId: args.entityId,
      key,
      value,
      confidence: 1.0,
      source: "user_action",
      expiresAt: Date.now() + MEMORY_DEFAULT_TTL_MS,
      metadata: args.metadata,
    });
  },
});

/** Internal: same as storeEntityRelation but no auth. For Mastra tools invoked from backend. */
export const storeEntityRelationInternal = internalMutation({
  args: {
    fromType: v.string(),
    fromId: v.string(),
    relationType: v.string(),
    toType: v.string(),
    toId: v.string(),
    userId: v.optional(v.string()),
    strength: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("entityRelations"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("entityRelations")
      .withIndex("from_to_relation", (q) =>
        q
          .eq("fromType", args.fromType)
          .eq("fromId", args.fromId)
          .eq("toId", args.toId)
          .eq("relationType", args.relationType),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        strength: Math.min(1.0, (existing.strength ?? 0.5) + 0.1),
        metadata: args.metadata,
      });
      return existing._id;
    }

    return ctx.db.insert("entityRelations", {
      ...args,
      strength: args.strength ?? 0.5,
      createdAt: Date.now(),
    });
  },
});

export const storeEntityRelation = mutation({
  args: {
    fromType: v.string(),
    fromId: v.string(),
    relationType: v.string(),
    toType: v.string(),
    toId: v.string(),
    userId: v.optional(v.string()),
    strength: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("entityRelations"),
  handler: async (ctx, args) => {
    if (args.userId != null) {
      const authUserId = await optionalAuth(ctx);
      if (authUserId !== args.userId) {
        await requireAdmin(ctx);
      }
    }
    const existing = await ctx.db
      .query("entityRelations")
      .withIndex("from_to_relation", (q) =>
        q
          .eq("fromType", args.fromType)
          .eq("fromId", args.fromId)
          .eq("toId", args.toId)
          .eq("relationType", args.relationType),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        strength: Math.min(1.0, (existing.strength ?? 0.5) + 0.1),
        metadata: args.metadata,
      });
      return existing._id;
    }

    return ctx.db.insert("entityRelations", {
      ...args,
      strength: args.strength ?? 0.5,
      createdAt: Date.now(),
    });
  },
});

export const getRelatedEntities = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    relationType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      toType: v.string(),
      toId: v.string(),
      relationType: v.string(),
      strength: v.number(),
    }),
  ),
  handler: async (ctx, { entityType, entityId, relationType, limit = 10 }) => {
    const queryResult = ctx.db
      .query("entityRelations")
      .withIndex("from", (q) =>
        q.eq("fromType", entityType).eq("fromId", entityId),
      );

    const results = await queryResult.collect();

    return results
      .filter((r) => !relationType || r.relationType === relationType)
      .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
      .slice(0, limit)
      .map((r) => ({
        toType: r.toType,
        toId: r.toId,
        relationType: r.relationType,
        strength: r.strength ?? 0.5,
      }));
  },
});

export const deleteExpired = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, { limit = 100 }) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("agentMemory")
      .withIndex("expiresAt", (q) => q.lt("expiresAt", now))
      .take(limit);

    let deleted = 0;
    for (const memory of expired) {
      if (memory.embeddingId) {
        const embedding = await ctx.db.get(memory.embeddingId);
        if (embedding) await ctx.db.delete(embedding._id);
      }
      await ctx.db.delete(memory._id);
      deleted++;
    }

    return { deleted };
  },
});

function buildMemorySummary(
  preferences: any[],
  constraints: any[],
  interactions: any[],
  lastSearchSummary?: {
    query: string;
    location: string | null;
    budgetHint: string | null;
    findingsCount: number;
  } | null,
): string {
  const parts: string[] = [];

  if (preferences.length > 0) {
    const prefStrings = preferences.map((p) => {
      try {
        return `${p.key}: ${p.value}`;
      } catch {
        return p.key;
      }
    });
    parts.push(`User preferences: ${prefStrings.join(", ")}`);
  }

  if (constraints.length > 0) {
    const constraintStrings = constraints.map((c) => {
      try {
        return `${c.key}: ${c.value}`;
      } catch {
        return c.key;
      }
    });
    parts.push(`Constraints: ${constraintStrings.join(", ")}`);
  }

  if (lastSearchSummary) {
    const loc = lastSearchSummary.location
      ? ` in ${lastSearchSummary.location}`
      : "";
    const budget = lastSearchSummary.budgetHint
      ? ` (${lastSearchSummary.budgetHint})`
      : "";
    parts.push(
      `Last search: "${lastSearchSummary.query}"${loc}${budget}, ${lastSearchSummary.findingsCount} results`,
    );
  }

  if (interactions.length > 0) {
    parts.push(`Recent activity: ${interactions.length} interactions tracked`);
  }

  return (
    parts.join(". ") || "No specific preferences or constraints recorded yet."
  );
}

export const MEMORY_TEMPLATES = {
  AGE_PREFERENCE: (value: number | string) => ({
    key: "age_preference",
    value: String(value),
    memoryType: "preference" as MemoryType,
    source: "explicit",
  }),
  BUDGET_PREFERENCE: (value: number) => ({
    key: "budget_preference",
    value: String(value),
    memoryType: "preference" as MemoryType,
    source: "inferred_from_search",
  }),
  LOCATION_PREFERENCE: (location: string) => ({
    key: `location_preference_${location.toLowerCase()}`,
    value: location,
    memoryType: "preference" as MemoryType,
    source: "inferred_from_search",
  }),
  PROPERTY_TYPE_PREFERENCE: (type: string) => ({
    key: "property_type_preference",
    value: type,
    memoryType: "preference" as MemoryType,
    source: "inferred_from_search",
  }),
  BEDS_CONSTRAINT: (beds: number) => ({
    key: "min_beds_constraint",
    value: String(beds),
    memoryType: "constraint" as MemoryType,
    source: "explicit",
  }),
};
