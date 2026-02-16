/**
 * Property service - list, search, get.
 */

import { internalMutation, mutation, query } from "../_generated/server";
import {
  SEARCH_CACHE_TTL_HOT_MS,
  SEARCH_CACHE_TTL_WARM_MS,
  SEARCH_CACHE_TTL_COLD_MS,
  SEARCH_CACHE_EVICT_AFTER_MS,
} from "../agents/_lib/constants";
import { Infer, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { addImageUrls } from "../lib/imageUrls";
import { propertyWithUrlValidator } from "../domain/validators";

// ── Search text helpers ────────────────────────────────────────────────────

/** Build combined searchable text from property fields */
function buildSearchText(property: {
  title: string;
  address: string;
  description: string;
  location?: string | null;
  area?: string | null;
  beds?: number;
  baths?: number;
  price?: number;
}): string {
  const parts = [
    property.title,
    property.address,
    property.description,
    property.location ?? "",
    property.area ?? "",
    property.beds ? `${property.beds} bedroom` : "",
    property.beds ? `${property.beds} غرف` : "",
    property.baths ? `${property.baths} bathroom` : "",
    property.price ? `${property.price} SAR` : "",
    property.price ? `${property.price} ريال` : "",
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** Normalize search query for better matching */
function normalizeQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[،,]/g, " ")
    .replace(/\bفي\b/g, "")
    .replace(/\bفى\b/g, "")
    .replace(/\bب\b/g, "")
    .replace(/\bال\b/g, "")
    .trim();
}

/** Normalization pairs for cache similarity (شقق↔شقة, apartment↔apartments, الرياض↔riyadh) */
const NORMALIZE_FOR_CACHE: [RegExp, string][] = [
  [/\bشقق\b/g, "شقة"],
  [/\bعقارات\b/g, "عقار"],
  [/\bapartments\b/g, "apartment"],
  [/\bvillas\b/g, "villa"],
  [/الرياض/g, "riyadh"],
  [/جدة|جده/g, "jeddah"],
  [/الدمام/g, "dammam"],
];

function normalizeQueryForCache(q: string): string {
  let out = normalizeQuery(q);
  for (const [re, repl] of NORMALIZE_FOR_CACHE) {
    out = out.replace(re, repl);
  }
  return out;
}

const QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "at",
  "for",
  "of",
  "to",
  "with",
  "property",
  "properties",
  "home",
  "house",
  "real",
  "estate",
  "في",
  "من",
  "على",
  "الى",
  "إلى",
  "عن",
  "عقار",
  "عقارات",
  "شقة",
  "شقق",
  "منزل",
  "بيت",
]);

function tokenizeForCache(query: string): string[] {
  const normalized = normalizeQueryForCache(query);
  return normalized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !QUERY_STOPWORDS.has(t));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Extract location hints from Arabic/English query */
function extractLocationHint(q: string): string | undefined {
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
    "tabuk",
    "تبوك",
    "abha",
    "أبها",
    "taif",
    "الطائف",
    "jubail",
    "الجبيل",
    "yanbu",
    "ينبع",
    "dhahran",
    "الظهران",
  ];
  const normalized = q.toLowerCase();
  for (const city of saudiCities) {
    if (normalized.includes(city)) {
      return city;
    }
  }
  return undefined;
}

export const list = query({
  args: {
    limit: v.optional(v.number()),
    bankId: v.optional(v.id("banks")),
    partnerId: v.optional(v.id("partners")),
  },
  returns: v.array(propertyWithUrlValidator),
  handler: async (ctx, { limit = 50, bankId, partnerId }) => {
    let results;
    if (bankId) {
      results = await ctx.db
        .query("properties")
        .withIndex("bankId", (p) => p.eq("bankId", bankId))
        .order("desc")
        .take(limit);
    } else if (partnerId) {
      results = await ctx.db
        .query("properties")
        .withIndex("partnerId", (p) => p.eq("partnerId", partnerId))
        .order("desc")
        .take(limit);
    } else {
      results = await ctx.db.query("properties").order("desc").take(limit);
    }
    return addImageUrls(ctx, results);
  },
});

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    onlyAvailable: v.optional(v.boolean()),
  },
  returns: v.array(propertyWithUrlValidator),
  handler: async (ctx, { query: q, limit = 20, onlyAvailable = true }) => {
    const normalized = normalizeQuery(q);

    // Try multi-field search first (if searchText is populated)
    let results = await ctx.db
      .query("properties")
      .withSearchIndex("search_full", (s) => s.search("searchText", normalized))
      .take(limit * 2); // Get extra for filtering

    // Fallback to description-only search if no results
    if (results.length === 0) {
      results = await ctx.db
        .query("properties")
        .withSearchIndex("search_body", (s) =>
          s.search("description", normalized),
        )
        .take(limit * 2);
    }

    // Filter by availability if requested
    if (onlyAvailable) {
      results = results.filter((p) => !p.status || p.status === "available");
    }

    // Return limited results with image URLs
    return addImageUrls(ctx, results.slice(0, limit));
  },
});

export const searchPaginated = query({
  args: {
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { query: q, paginationOpts }) => {
    const normalized = normalizeQuery(q);

    const paginated = await ctx.db
      .query("properties")
      .withSearchIndex("search_full", (s) => s.search("searchText", normalized))
      .paginate(paginationOpts);

    return {
      ...paginated,
      page: await addImageUrls(ctx, paginated.page),
    };
  },
});

export const getById = query({
  args: { id: v.id("properties") },
  returns: v.union(propertyWithUrlValidator, v.null()),
  handler: async (ctx, { id }) => {
    const property = await ctx.db.get(id);
    if (!property) return null;
    const [withUrl] = await addImageUrls(ctx, [property]);
    return withUrl;
  },
});

export const logSearchEvent = mutation({
  args: {
    query: v.string(),
    userId: v.optional(v.string()),
    location: v.optional(v.string()),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    stage: v.optional(
      v.union(
        v.literal("query_received"),
        v.literal("db_checked"),
        v.literal("serper_attempt"),
        v.literal("browserbase_attempt"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("success"),
        v.literal("error"),
        v.literal("empty"),
        v.literal("skipped"),
      ),
    ),
    source: v.optional(
      v.union(
        v.literal("internal_db"),
        v.literal("serper"),
        v.literal("browserbase_fallback"),
        v.literal("search_memory"),
        v.literal("failed"),
      ),
    ),
    resultCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.id("searchLogs"),
  handler: async (ctx, args) => {
    return ctx.db.insert("searchLogs", args);
  },
});

export const getRecentSearchCount = query({
  args: {
    userId: v.string(),
    query: v.string(),
    lookbackMs: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, { userId, query, lookbackMs = 1000 * 60 * 60 * 24 }) => {
    const since = Date.now() - lookbackMs;
    const normalizedQuery = normalizeQuery(query);
    const rows = await ctx.db
      .query("searchLogs")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((row) => {
      if (!row.query) return false;
      if ((row.stage ?? "completed") !== "completed") return false;
      if (row._creationTime < since) return false;
      return normalizeQuery(row.query) === normalizedQuery;
    }).length;
  },
});

export const logKnowledgeResearch = mutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    query: v.string(),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    status: v.union(
      v.literal("completed"),
      v.literal("partial"),
      v.literal("failed"),
    ),
    requestedTopSources: v.number(),
    requestedTopCardsPerSource: v.number(),
    createdAt: v.number(),
    taskList: v.array(v.string()),
    searchTerms: v.array(v.string()),
    sourceRuns: v.array(
      v.object({
        rank: v.number(),
        title: v.string(),
        url: v.string(),
        snippet: v.optional(v.string()),
      }),
    ),
    propertyFindings: v.array(
      v.object({
        sourceRank: v.number(),
        sourceUrl: v.string(),
        cardRank: v.number(),
        propertyUrl: v.optional(v.string()),
        title: v.string(),
        description: v.optional(v.string()),
        priceHint: v.optional(v.string()),
        locationHint: v.optional(v.string()),
        imageUrls: v.array(v.string()),
        offerDetails: v.optional(v.string()),
        confidence: v.optional(v.number()),
        bathrooms: v.optional(v.string()),
        area: v.optional(v.string()),
        features: v.optional(v.array(v.string())),
        beds: v.optional(v.string()),
      }),
    ),
    errorSummary: v.optional(v.string()),
  },
  returns: v.id("knowledgeResearch"),
  handler: async (ctx, args) => {
    return ctx.db.insert("knowledgeResearch", args);
  },
});

/** Property finding shape for cached search results */
const propertyFindingValidator = v.object({
  sourceRank: v.number(),
  sourceUrl: v.string(),
  cardRank: v.number(),
  propertyUrl: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  priceHint: v.optional(v.string()),
  locationHint: v.optional(v.string()),
  imageUrls: v.array(v.string()),
  offerDetails: v.optional(v.string()),
  confidence: v.optional(v.number()),
  bathrooms: v.optional(v.string()),
  area: v.optional(v.string()),
  features: v.optional(v.array(v.string())),
  beds: v.optional(v.string()),
});

type PropertyFindingCached = Infer<typeof propertyFindingValidator>;

/** Three-tier cache: L1 (15m) → L2 (3d) → L3 (15d). Find similar knowledgeResearch for reuse. */
export const getCachedSearchResults = query({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    query: v.string(),
    limit: v.optional(v.number()),
    maxAgeMs: v.optional(v.number()), // deprecated; uses L1→L2→L3 when omitted
  },
  returns: v.union(
    v.null(),
    v.object({
      query: v.string(),
      createdAt: v.number(),
      propertyFindings: v.array(propertyFindingValidator),
      status: v.string(),
    }),
  ),
  handler: async (ctx, { userId, threadId, query, limit = 3, maxAgeMs }) => {
    const now = Date.now();
    const tierCutoffs = maxAgeMs
      ? [now - maxAgeMs]
      : [
          now - SEARCH_CACHE_TTL_HOT_MS,
          now - SEARCH_CACHE_TTL_WARM_MS,
          now - SEARCH_CACHE_TTL_COLD_MS,
        ];
    const minFindings = Math.min(limit, 3);
    const queryNorm = normalizeQueryForCache(query);
    const queryTokens = tokenizeForCache(query);
    const queryLocation = extractLocationHint(query);

    for (const cutoff of tierCutoffs) {
      const candidates: Array<{
        query: string;
        createdAt: number;
        status: string;
        propertyFindings: PropertyFindingCached[];
      }> = [];

      if (threadId) {
        const byThread = await ctx.db
          .query("knowledgeResearch")
          .withIndex("by_threadId_and_createdAt", (q) =>
            q.eq("threadId", threadId),
          )
          .order("desc")
          .take(30);
        for (const r of byThread) {
          if (r.userId !== userId) continue;
          if (r.status !== "completed") continue;
          if (r.createdAt < cutoff) continue;
          candidates.push({
            query: r.query,
            createdAt: r.createdAt,
            status: r.status,
            propertyFindings: r.propertyFindings as PropertyFindingCached[],
          });
        }
      }

      const byUser = await ctx.db
        .query("knowledgeResearch")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
        .order("desc")
        .take(50);
      for (const r of byUser) {
        if (r.status !== "completed") continue;
        if (r.createdAt < cutoff) continue;
        if (threadId && r.threadId !== threadId) continue;
        if (
          candidates.some(
            (c) => c.query === r.query && c.createdAt === r.createdAt,
          )
        )
          continue;
        candidates.push({
          query: r.query,
          createdAt: r.createdAt,
          status: r.status,
          propertyFindings: r.propertyFindings as PropertyFindingCached[],
        });
      }

      candidates.sort((a, b) => b.createdAt - a.createdAt);

      for (const record of candidates) {
        if (record.propertyFindings.length < minFindings) continue;

        const recordNorm = normalizeQueryForCache(record.query);
        if (queryNorm === recordNorm) {
          return {
            query: record.query,
            createdAt: record.createdAt,
            propertyFindings: record.propertyFindings,
            status: record.status,
          };
        }

        const recordTokens = tokenizeForCache(record.query);
        const similarity = jaccardSimilarity(queryTokens, recordTokens);
        if (similarity < 0.5) continue;

        const recordLocation = extractLocationHint(record.query);
        if (queryLocation && recordLocation && queryLocation !== recordLocation)
          continue;

        return {
          query: record.query,
          createdAt: record.createdAt,
          propertyFindings: record.propertyFindings,
          status: record.status,
        };
      }
    }
    return null;
  },
});

/** Get the most recent search context for a user (and optionally thread) for follow-up reuse. */
export const getLastSearchContext = query({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      query: v.string(),
      findingsCount: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { userId, threadId }) => {
    if (threadId) {
      const byThread = await ctx.db
        .query("knowledgeResearch")
        .withIndex("by_threadId_and_createdAt", (q) =>
          q.eq("threadId", threadId),
        )
        .order("desc")
        .first();
      if (byThread) {
        return {
          query: byThread.query,
          findingsCount: byThread.propertyFindings.length,
          createdAt: byThread.createdAt,
        };
      }
    }
    const byUser = await ctx.db
      .query("knowledgeResearch")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!byUser) return null;
    return {
      query: byUser.query,
      findingsCount: byUser.propertyFindings.length,
      createdAt: byUser.createdAt,
    };
  },
});

/** Get the list of findings from the most recent search (for resolving "the second one" / "more details"). */
export const getLastSearchFindings = query({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    maxFindings: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      query: v.string(),
      createdAt: v.number(),
      findings: v.array(
        v.object({
          index: v.number(),
          title: v.string(),
          propertyUrl: v.optional(v.string()),
          description: v.optional(v.string()),
          priceHint: v.optional(v.string()),
          locationHint: v.optional(v.string()),
          bathrooms: v.optional(v.string()),
          area: v.optional(v.string()),
          features: v.optional(v.array(v.string())),
          beds: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { userId, threadId, maxFindings = 10 }) => {
    let record: {
      query: string;
      createdAt: number;
      propertyFindings: Array<{
        title: string;
        propertyUrl?: string;
        description?: string;
        priceHint?: string;
        locationHint?: string;
        bathrooms?: string;
        area?: string;
        features?: string[];
        beds?: string;
      }>;
    } | null = null;
    if (threadId) {
      const byThread = await ctx.db
        .query("knowledgeResearch")
        .withIndex("by_threadId_and_createdAt", (q) =>
          q.eq("threadId", threadId),
        )
        .order("desc")
        .first();
      record = byThread;
    }
    if (!record) {
      const byUser = await ctx.db
        .query("knowledgeResearch")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
      record = byUser;
    }
    if (!record || !record.propertyFindings.length) return null;
    const limit = Math.min(maxFindings, record.propertyFindings.length);
    const findings = record.propertyFindings.slice(0, limit).map((f, i) => ({
      index: i + 1,
      title: f.title,
      propertyUrl: f.propertyUrl,
      description: f.description,
      priceHint: f.priceHint,
      locationHint: f.locationHint,
      bathrooms: f.bathrooms,
      area: f.area,
      features: f.features,
      beds: f.beds,
    }));
    return {
      query: record.query,
      createdAt: record.createdAt,
      findings,
    };
  },
});

// ── Backfill & maintenance ─────────────────────────────────────────────────

/** Backfill searchText for existing properties (run once after schema update) */
export const backfillSearchText = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: v.object({
    updated: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, { batchSize = 100 }) => {
    // Find properties without searchText
    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("searchText"), undefined))
      .take(batchSize);

    let updated = 0;
    for (const property of properties) {
      const searchText = buildSearchText({
        title: property.title,
        address: property.address,
        description: property.description,
        location: property.location,
        area: property.area,
        beds: property.beds,
        baths: property.baths,
        price: property.price,
      });
      await ctx.db.patch(property._id, { searchText });
      updated++;
    }

    // Count remaining
    const remaining = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("searchText"), undefined))
      .collect();

    return { updated, remaining: remaining.length };
  },
});

/** Delete knowledgeResearch records older than 15 days. Run via cron. */
export const deleteExpiredKnowledgeResearch = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, { limit = 500 }) => {
    const cutoff = Date.now() - SEARCH_CACHE_EVICT_AFTER_MS;

    const expired = await ctx.db
      .query("knowledgeResearch")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(limit);

    let deleted = 0;
    for (const rec of expired) {
      await ctx.db.delete(rec._id);
      deleted++;
    }

    if (deleted > 0) {
      console.log("[properties] deleteExpiredKnowledgeResearch", {
        deleted,
        cutoff,
      });
    }
    return { deleted };
  },
});

/** Update searchText when property is created/updated (call from admin mutations) */
export const updatePropertySearchText = internalMutation({
  args: { propertyId: v.id("properties") },
  returns: v.null(),
  handler: async (ctx, { propertyId }) => {
    const property = await ctx.db.get(propertyId);
    if (!property) return null;

    const searchText = buildSearchText({
      title: property.title,
      address: property.address,
      description: property.description,
      location: property.location,
      area: property.area,
      beds: property.beds,
      baths: property.baths,
      price: property.price,
    });
    await ctx.db.patch(propertyId, { searchText });
    return null;
  },
});

// Export helpers for use in tools
export { normalizeQuery, extractLocationHint };
