import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { roleValidator } from "./roles";

export default defineSchema({
  // ── Business tables ───────────────────────────────────────────────────

  /** Real estate developers / partners */
  partners: defineTable({
    name: v.string(),
    slug: v.string(),
    apiKeyHash: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("pending"))),
    contactEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  })
    .index("slug", ["slug"])
    .index("status", ["status"]),

  /** Properties listed by developers */
  properties: defineTable({
    title: v.string(),
    address: v.string(),
    price: v.number(),
    beds: v.number(),
    baths: v.number(),
    sqft: v.optional(v.number()),
    bankId: v.optional(v.id("banks")),
    partnerId: v.optional(v.id("partners")),
    imageId: v.optional(v.id("_storage")),
    description: v.string(),
    body: v.optional(v.any()),
    location: v.optional(v.string()),
    area: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("available"), v.literal("sold"), v.literal("reserved")),
    ),
    /** Combined searchable text: title + address + description + location + area */
    searchText: v.optional(v.string()),
  })
    .index("partnerId", ["partnerId"])
    .index("bankId", ["bankId"])
    .index("status", ["status"])
    .searchIndex("search_body", { searchField: "description" })
    .searchIndex("search_full", { searchField: "searchText" }),

  /** Property–bank many-to-many (a property can be linked to multiple banks) */
  propertyBanks: defineTable({
    propertyId: v.id("properties"),
    bankId: v.id("banks"),
  })
    .index("propertyId", ["propertyId"])
    .index("bankId", ["bankId"])
    .index("propertyId_bankId", ["propertyId", "bankId"]),

  /** Banks / lenders */
  banks: defineTable({
    name: v.string(),
    slug: v.string(),
    contactEmail: v.string(),
    rules: v.optional(v.any()),
    // Legacy: products array kept optional for backward compat with existing data
    products: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          description: v.optional(v.string()),
          rules: v.optional(v.any()),
        }),
      ),
    ),
    // Legacy: state kept optional for backward compat
    state: v.optional(v.string()),
    // New typed status
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("suspended"),
      ),
    ),
    logoId: v.optional(v.id("_storage")),
    description: v.optional(v.string()),
  })
    .index("slug", ["slug"])
    .index("status", ["status"]),

  /** Normalized bank products (separated from banks.products) */
  bankProducts: defineTable({
    bankId: v.id("banks"),
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    rules: v.optional(v.any()),
  })
    .index("bankId", ["bankId"])
    .index("type", ["type"]),

  /** Pending admin agent create actions that require explicit confirm/cancel. */
  adminPendingActions: defineTable({
    threadId: v.string(),
    createdBy: v.string(),
    actionType: v.string(),
    entityType: v.union(
      v.literal("property"),
      v.literal("bank"),
      v.literal("partner"),
      v.literal("bankProduct"),
      v.literal("other"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("executed"),
      v.literal("failed"),
    ),
    draftPayload: v.any(),
    editablePayload: v.any(),
    needsMedia: v.boolean(),
    executionResult: v.optional(v.any()),
    confirmedBy: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    cancelledBy: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index("threadId", ["threadId"])
    .index("status", ["status"])
    .index("threadId_and_status", ["threadId", "status"]),

  /** Media for entity galleries and pre-confirm pending action uploads. */
  entityMedia: defineTable({
    pendingActionId: v.optional(v.id("adminPendingActions")),
    entityType: v.union(
      v.literal("property"),
      v.literal("bank"),
      v.literal("partner"),
    ),
    entityId: v.optional(v.string()),
    storageId: v.id("_storage"),
    kind: v.optional(v.union(v.literal("image"), v.literal("logo"))),
    sortOrder: v.number(),
    isPrimary: v.optional(v.boolean()),
    caption: v.optional(v.string()),
    uploadedBy: v.optional(v.string()),
  })
    .index("pendingActionId", ["pendingActionId"])
    .index("entityType_and_entityId", ["entityType", "entityId"])
    .index("pendingActionId_and_sortOrder", ["pendingActionId", "sortOrder"])
    .index("entityType_and_entityId_and_sortOrder", [
      "entityType",
      "entityId",
      "sortOrder",
    ]),

  /** User profiles with all fields the agent depends on */
  userProfiles: defineTable({
    userId: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    salary: v.optional(v.number()),
    employment: v.optional(v.string()),
    employer: v.optional(v.string()),
    firstTimeBuyer: v.optional(v.boolean()),
    kids: v.optional(v.number()),
    minBeds: v.optional(v.number()),
    maxBudget: v.optional(v.number()),
    preferredLocation: v.optional(v.string()),
    preferredFloor: v.optional(v.string()),
    needsParking: v.optional(v.boolean()),
    propertyType: v.optional(v.string()),
    finishes: v.optional(v.string()),
    notes: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    source: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    planType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
    planExpiresAt: v.optional(v.number()),
    chatLimit: v.optional(v.number()),
  })
    .index("userId", ["userId"])
    .index("source", ["source"]),

  /** Orders / pipeline (property viewings, loan applications, etc.) */
  orders: defineTable({
    userId: v.string(),
    type: v.union(v.literal("property"), v.literal("loan")),
    status: v.union(
      v.literal("new_lead"),
      v.literal("contacted"),
      v.literal("qualified"),
      v.literal("offer_made"),
      v.literal("under_contract"),
      v.literal("closed_won"),
      v.literal("closed_lost"),
    ),
    propertyId: v.optional(v.id("properties")),
    bankId: v.optional(v.id("banks")),
    partnerId: v.optional(v.id("partners")),
    intent: v.optional(v.string()),
    notes: v.optional(v.string()),
    bankProductId: v.optional(v.id("bankProducts")),
    userNameSnapshot: v.optional(v.string()),
    userPhoneSnapshot: v.optional(v.string()),
    budgetSnapshot: v.optional(v.number()),
    preferredLocationSnapshot: v.optional(v.string()),
    sourceChannel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    confidenceScore: v.optional(v.number()),
    serviceCategory: v.optional(
      v.union(
        v.literal("buy_property"),
        v.literal("sell_property"),
        v.literal("property_financing"),
        v.literal("loan_consultation"),
        v.literal("other"),
      ),
    ),
    recommendationSource: v.optional(
      v.union(
        v.literal("internal_db"),
        v.literal("web_fallback"),
        v.literal("mixed"),
      ),
    ),
    recommendationSummary: v.optional(v.string()),
    aiHandoffReason: v.optional(v.string()),
    customerNeedsSummary: v.optional(v.string()),
    salesTalkingPoints: v.optional(v.string()),
    recommendedPropertyIds: v.optional(v.array(v.id("properties"))),
    recommendedBankProductIds: v.optional(v.array(v.id("bankProducts"))),
    assignedTo: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    nextAction: v.optional(v.string()),
    nextActionAt: v.optional(v.number()),
    handoffId: v.optional(v.id("humanHandoffs")),
    threadId: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("status", ["status"])
    .index("type", ["type"])
    .index("propertyId", ["propertyId"])
    .index("bankId", ["bankId"])
    // Composite indexes for common query patterns
    .index("userId_and_status", ["userId", "status"])
    .index("userId_and_type", ["userId", "type"])
    .index("partnerId", ["partnerId"])
    .index("assignedTo", ["assignedTo"])
    .index("priority", ["priority"])
    .index("handoffId", ["handoffId"])
    .index("sourceChannel", ["sourceChannel"])
    .index("threadId", ["threadId"]),

  /** Multi-reason timeline for a single conversation thread. */
  conversationReasons: defineTable({
    userId: v.string(),
    threadId: v.optional(v.string()),
    orderId: v.optional(v.id("orders")),
    handoffId: v.optional(v.id("humanHandoffs")),
    reasonCategory: v.union(
      v.literal("buy_property"),
      v.literal("sell_property"),
      v.literal("property_search"),
      v.literal("property_financing"),
      v.literal("loan_consultation"),
      v.literal("other"),
    ),
    intent: v.optional(v.string()),
    summaryArabic: v.string(),
    nextActionArabic: v.string(),
    discussedTopics: v.optional(v.array(v.string())),
    propertyId: v.optional(v.id("properties")),
    bankId: v.optional(v.id("banks")),
    bankProductId: v.optional(v.id("bankProducts")),
    recommendationSource: v.optional(
      v.union(
        v.literal("internal_db"),
        v.literal("web_fallback"),
        v.literal("mixed"),
      ),
    ),
    recommendationSummary: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("threadId", ["threadId"])
    .index("orderId", ["orderId"])
    .index("handoffId", ["handoffId"])
    .index("userId_and_reasonCategory", ["userId", "reasonCategory"]),

  /** Thread lifecycle metadata for expiration and cleanup. */
  threadMetadata: defineTable({
    threadId: v.string(),
    userId: v.string(),
    lastActivityAt: v.number(),
    expiresAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
  })
    .index("threadId", ["threadId"])
    .index("userId", ["userId"])
    .index("expiresAt", ["expiresAt"])
    .index("archivedAt", ["archivedAt"]),

  /** User activity event log for analytics */
  userActivity: defineTable({
    userId: v.string(),
    action: v.union(
      v.literal("message_sent"),
      v.literal("search"),
      v.literal("order_created"),
      v.literal("login"),
      v.literal("property_viewed"),
    ),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    metadata: v.optional(v.any()),
  })
    .index("userId", ["userId"])
    // Composite index for filtering by user and action type
    .index("userId_and_action", ["userId", "action"]),

  /** Search logs for "most searched areas" analytics */
  searchLogs: defineTable({
    userId: v.optional(v.string()),
    query: v.string(),
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
  })
    .index("userId", ["userId"])
    .index("location", ["location"]),

  /** Admin-only knowledge research trail for user-initiated web/property searches. */
  knowledgeResearch: defineTable({
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
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_channel_and_createdAt", ["channel", "createdAt"])
    .index("by_threadId_and_createdAt", ["threadId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  /** User notifications */
  notifications: defineTable({
    userId: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    read: v.boolean(),
    type: v.optional(v.string()),
    linkId: v.optional(v.string()),
    audience: v.optional(
      v.union(v.literal("sales"), v.literal("admin"), v.literal("user")),
    ),
    entityType: v.optional(
      v.union(v.literal("order"), v.literal("handoff"), v.literal("customer")),
    ),
    entityId: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    actionRequired: v.optional(v.boolean()),
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("acknowledged"),
        v.literal("resolved"),
      ),
    ),
    metadata: v.optional(v.any()),
  })
    .index("userId", ["userId"])
    .index("userId_and_read", ["userId", "read"])
    .index("type", ["type"])
    .index("entityId", ["entityId"]),

  /** User reviews on properties / developers */
  reviews: defineTable({
    userId: v.string(),
    targetType: v.union(v.literal("property"), v.literal("partner")),
    targetId: v.string(),
    rating: v.number(),
    comment: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("targetType_and_targetId", ["targetType", "targetId"]),

  /** User favorite / saved properties */
  favorites: defineTable({
    userId: v.string(),
    propertyId: v.id("properties"),
  })
    .index("userId", ["userId"])
    .index("propertyId", ["propertyId"])
    .index("userId_and_propertyId", ["userId", "propertyId"]),

  // ── Content tables ────────────────────────────────────────────────────

  prompts: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("key", ["key"]),

  // AI Configuration settings (models, temperature, etc.)
  aiSettings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("key", ["key"]),

  knowledgePages: defineTable({
    slug: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
  })
    .index("slug", ["slug"])
    .index("category", ["category"]),

  // ── System / Auth tables ──────────────────────────────────────────────

  humanHandoffs: defineTable({
    userId: v.string(),
    intent: v.string(),
    status: v.optional(v.string()),
    aiHandoffReason: v.optional(v.string()),
    customerNeedsSummary: v.optional(v.string()),
    salesTalkingPoints: v.optional(v.string()),
    recommendationSummary: v.optional(v.string()),
    threadId: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("threadId", ["threadId"]),

  pendingVerifications: defineTable({
    phoneNumber: v.string(),
    otp: v.string(),
    expiresAt: v.number(),
  }).index("phoneNumber", ["phoneNumber"]),

  otpRequests: defineTable({
    phoneNumber: v.string(),
  }).index("phoneNumber", ["phoneNumber"]),

  verifiedPhones: defineTable({
    phoneNumber: v.string(),
    verifiedAt: v.number(),
    userId: v.optional(v.string()),
  })
    .index("phoneNumber", ["phoneNumber"])
    .index("userId", ["userId"]),

  /** One-time session tokens for WhatsApp-verified phones. Consumed when creating Better Auth session. */
  sessionTokens: defineTable({
    phoneNumber: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("phoneNumber", ["phoneNumber"])
    .index("token", ["token"]),

  /** Admin allowlist: only these userIds (Better Auth) can access the admin app and admin-only Convex functions. */
  adminUsers: defineTable({
    userId: v.string(),
  }).index("userId", ["userId"]),

  /** Admin profile (avatar etc.) keyed by Better Auth userId. */
  adminProfiles: defineTable({
    userId: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
  }).index("userId", ["userId"]),

  /** User role by phone number. No row = "user". Separate from userProfiles. */
  userRoles: defineTable({
    phoneNumber: v.string(),
    role: roleValidator,
  }).index("phoneNumber", ["phoneNumber"]),

  /** Agent traces for replay/simulator and column test fixtures. No PII in fixtures. */
  agentTraces: defineTable({
    threadId: v.string(),
    userId: v.optional(v.string()),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    userMessage: v.string(),
    toolCalls: v.array(
      v.object({
        name: v.string(),
        args: v.any(),
      }),
    ),
    toolResults: v.array(
      v.object({
        name: v.string(),
        result: v.any(),
      }),
    ),
    assistantMessage: v.string(),
    searchTrace: v.optional(
      v.object({
        query: v.optional(v.string()),
        offset: v.optional(v.number()),
        sourceUrls: v.optional(v.array(v.string())),
        cardUrls: v.optional(v.array(v.string())),
      }),
    ),
  }).index("threadId", ["threadId"]),

  // ── Agent Memory tables ──────────────────────────────────────────────

  /** Agent memory for cross-session persistence of user preferences, facts, and interactions. */
  agentMemory: defineTable({
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
    embeddingId: v.optional(v.id("agentMemoryEmbeddings")),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("userId", ["userId"])
    .index("userId_and_memoryType", ["userId", "memoryType"])
    .index("entityType_and_entityId", ["entityType", "entityId"])
    .index("userId_and_key", ["userId", "key"])
    .index("expiresAt", ["expiresAt"]),

  /** Vector embeddings for agent memory semantic search. */
  agentMemoryEmbeddings: defineTable({
    memoryId: v.id("agentMemory"),
    embedding: v.array(v.float64()),
  }),

  /** Entity relationships for knowledge graph traversal. */
  entityRelations: defineTable({
    fromType: v.string(),
    fromId: v.string(),
    relationType: v.string(),
    toType: v.string(),
    toId: v.string(),
    userId: v.optional(v.string()),
    strength: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("from", ["fromType", "fromId"])
    .index("to", ["toType", "toId"])
    .index("relationType", ["relationType"])
    .index("userId", ["userId"])
    .index("from_and_relation", ["fromType", "fromId", "relationType"]),

  /** AI Token usage tracking for dashboard analytics */
  aiTokenUsage: defineTable({
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cachedInputTokens: v.optional(v.number()),
    reasoningTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
  })
    .index("userId", ["userId"])
    .index("model", ["model"])
    .index("threadId", ["threadId"]),

  /** Search analytics for most searched areas */
  searchAnalytics: defineTable({
    query: v.string(),
    location: v.optional(v.string()),
    userId: v.optional(v.string()),
    channel: v.optional(
      v.union(v.literal("whatsapp"), v.literal("app"), v.literal("web")),
    ),
    resultType: v.optional(
      v.union(
        v.literal("property"),
        v.literal("bank"),
        v.literal("developer"),
        v.literal("area"),
      ),
    ),
    resultCount: v.optional(v.number()),
  })
    .index("location", ["location"])
    .index("userId", ["userId"])
    .index("query", ["query"]),
});
