/**
 * Order domain types and validators.
 */
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type OrderType = "property" | "loan";
export type OrderPriority = "low" | "medium" | "high" | "urgent";
export type OrderSourceChannel = "whatsapp" | "app" | "web";
export type OrderServiceCategory =
  | "buy_property"
  | "sell_property"
  | "property_financing"
  | "loan_consultation"
  | "other";
export type OrderRecommendationSource = "internal_db" | "web_fallback" | "mixed";
export type ConversationReasonCategory =
  | "buy_property"
  | "sell_property"
  | "property_search"
  | "property_financing"
  | "loan_consultation"
  | "other";
export type SalesSummaryFields = {
  aiHandoffReason: string;
  customerNeedsSummary: string;
  salesTalkingPoints: string;
  recommendationSummary: string;
};

export type OrderStatus =
  | "new_lead"
  | "contacted"
  | "qualified"
  | "offer_made"
  | "under_contract"
  | "closed_won"
  | "closed_lost";

export type Order = Doc<"orders">;

export interface OrderCreateInput {
  userId: string;
  type: OrderType;
  status?: OrderStatus;
  propertyId?: Id<"properties">;
  bankId?: Id<"banks">;
  partnerId?: Id<"partners">;
  bankProductId?: Id<"bankProducts">;
  intent?: string;
  notes?: string;
  userNameSnapshot?: string;
  userPhoneSnapshot?: string;
  budgetSnapshot?: number;
  preferredLocationSnapshot?: string;
  sourceChannel?: OrderSourceChannel;
  confidenceScore?: number;
  serviceCategory?: OrderServiceCategory;
  recommendationSource?: OrderRecommendationSource;
  recommendationSummary?: string;
  aiHandoffReason?: string;
  customerNeedsSummary?: string;
  salesTalkingPoints?: string;
  recommendedPropertyIds?: Id<"properties">[];
  recommendedBankProductIds?: Id<"bankProducts">[];
  assignedTo?: string;
  priority?: OrderPriority;
  nextAction?: string;
  nextActionAt?: number;
  handoffId?: Id<"humanHandoffs">;
  threadId?: string;
}

export interface OrderUpdateInput {
  type?: OrderType;
  status?: OrderStatus;
  propertyId?: Id<"properties">;
  bankId?: Id<"banks">;
  partnerId?: Id<"partners">;
  bankProductId?: Id<"bankProducts">;
  intent?: string;
  notes?: string;
  userNameSnapshot?: string;
  userPhoneSnapshot?: string;
  budgetSnapshot?: number;
  preferredLocationSnapshot?: string;
  sourceChannel?: OrderSourceChannel;
  confidenceScore?: number;
  serviceCategory?: OrderServiceCategory;
  recommendationSource?: OrderRecommendationSource;
  recommendationSummary?: string;
  aiHandoffReason?: string;
  customerNeedsSummary?: string;
  salesTalkingPoints?: string;
  recommendedPropertyIds?: Id<"properties">[];
  recommendedBankProductIds?: Id<"bankProducts">[];
  assignedTo?: string;
  priority?: OrderPriority;
  nextAction?: string;
  nextActionAt?: number;
  handoffId?: Id<"humanHandoffs">;
  threadId?: string;
}

// ============================================================================
// Validators
// ============================================================================

export const orderTypeValidator = v.union(
  v.literal("property"),
  v.literal("loan")
);

export const orderPriorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);

export const orderSourceChannelValidator = v.union(
  v.literal("whatsapp"),
  v.literal("app"),
  v.literal("web")
);

export const orderServiceCategoryValidator = v.union(
  v.literal("buy_property"),
  v.literal("sell_property"),
  v.literal("property_financing"),
  v.literal("loan_consultation"),
  v.literal("other")
);

export const orderRecommendationSourceValidator = v.union(
  v.literal("internal_db"),
  v.literal("web_fallback"),
  v.literal("mixed")
);

export const orderStatusValidator = v.union(
  v.literal("new_lead"),
  v.literal("contacted"),
  v.literal("qualified"),
  v.literal("offer_made"),
  v.literal("under_contract"),
  v.literal("closed_won"),
  v.literal("closed_lost")
);

export const orderCreateArgsValidator = {
  userId: v.string(),
  type: orderTypeValidator,
  status: v.optional(orderStatusValidator),
  propertyId: v.optional(v.id("properties")),
  bankId: v.optional(v.id("banks")),
  partnerId: v.optional(v.id("partners")),
  bankProductId: v.optional(v.id("bankProducts")),
  intent: v.optional(v.string()),
  notes: v.optional(v.string()),
  userNameSnapshot: v.optional(v.string()),
  userPhoneSnapshot: v.optional(v.string()),
  budgetSnapshot: v.optional(v.number()),
  preferredLocationSnapshot: v.optional(v.string()),
  sourceChannel: v.optional(orderSourceChannelValidator),
  confidenceScore: v.optional(v.number()),
  serviceCategory: v.optional(orderServiceCategoryValidator),
  recommendationSource: v.optional(orderRecommendationSourceValidator),
  recommendationSummary: v.optional(v.string()),
  aiHandoffReason: v.optional(v.string()),
  customerNeedsSummary: v.optional(v.string()),
  salesTalkingPoints: v.optional(v.string()),
  recommendedPropertyIds: v.optional(v.array(v.id("properties"))),
  recommendedBankProductIds: v.optional(v.array(v.id("bankProducts"))),
  assignedTo: v.optional(v.string()),
  priority: v.optional(orderPriorityValidator),
  nextAction: v.optional(v.string()),
  nextActionAt: v.optional(v.number()),
  handoffId: v.optional(v.id("humanHandoffs")),
  threadId: v.optional(v.string()),
};

export const orderUpdateArgsValidator = {
  id: v.id("orders"),
  type: v.optional(orderTypeValidator),
  status: v.optional(orderStatusValidator),
  propertyId: v.optional(v.id("properties")),
  bankId: v.optional(v.id("banks")),
  partnerId: v.optional(v.id("partners")),
  bankProductId: v.optional(v.id("bankProducts")),
  intent: v.optional(v.string()),
  notes: v.optional(v.string()),
  userNameSnapshot: v.optional(v.string()),
  userPhoneSnapshot: v.optional(v.string()),
  budgetSnapshot: v.optional(v.number()),
  preferredLocationSnapshot: v.optional(v.string()),
  sourceChannel: v.optional(orderSourceChannelValidator),
  confidenceScore: v.optional(v.number()),
  serviceCategory: v.optional(orderServiceCategoryValidator),
  recommendationSource: v.optional(orderRecommendationSourceValidator),
  recommendationSummary: v.optional(v.string()),
  aiHandoffReason: v.optional(v.string()),
  customerNeedsSummary: v.optional(v.string()),
  salesTalkingPoints: v.optional(v.string()),
  recommendedPropertyIds: v.optional(v.array(v.id("properties"))),
  recommendedBankProductIds: v.optional(v.array(v.id("bankProducts"))),
  assignedTo: v.optional(v.string()),
  priority: v.optional(orderPriorityValidator),
  nextAction: v.optional(v.string()),
  nextActionAt: v.optional(v.number()),
  handoffId: v.optional(v.id("humanHandoffs")),
  threadId: v.optional(v.string()),
};

// ============================================================================
// Return type validators
// ============================================================================

export const orderReturnValidator = v.object({
  _id: v.id("orders"),
  _creationTime: v.number(),
  userId: v.string(),
  type: orderTypeValidator,
  status: orderStatusValidator,
  propertyId: v.optional(v.id("properties")),
  bankId: v.optional(v.id("banks")),
  partnerId: v.optional(v.id("partners")),
  bankProductId: v.optional(v.id("bankProducts")),
  intent: v.optional(v.string()),
  notes: v.optional(v.string()),
  userNameSnapshot: v.optional(v.string()),
  userPhoneSnapshot: v.optional(v.string()),
  budgetSnapshot: v.optional(v.number()),
  preferredLocationSnapshot: v.optional(v.string()),
  sourceChannel: v.optional(orderSourceChannelValidator),
  confidenceScore: v.optional(v.number()),
  serviceCategory: v.optional(orderServiceCategoryValidator),
  recommendationSource: v.optional(orderRecommendationSourceValidator),
  recommendationSummary: v.optional(v.string()),
  aiHandoffReason: v.optional(v.string()),
  customerNeedsSummary: v.optional(v.string()),
  salesTalkingPoints: v.optional(v.string()),
  recommendedPropertyIds: v.optional(v.array(v.id("properties"))),
  recommendedBankProductIds: v.optional(v.array(v.id("bankProducts"))),
  assignedTo: v.optional(v.string()),
  priority: v.optional(orderPriorityValidator),
  nextAction: v.optional(v.string()),
  nextActionAt: v.optional(v.number()),
  handoffId: v.optional(v.id("humanHandoffs")),
  threadId: v.optional(v.string()),
});

export const orderListReturnValidator = v.array(orderReturnValidator);

// ============================================================================
// Status transition helpers
// ============================================================================

/** Valid status transitions for orders */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new_lead: ["contacted", "closed_lost"],
  contacted: ["qualified", "closed_lost"],
  qualified: ["offer_made", "closed_lost"],
  offer_made: ["under_contract", "closed_lost"],
  under_contract: ["closed_won", "closed_lost"],
  closed_won: [], // Terminal state
  closed_lost: [], // Terminal state
};

/**
 * Check if a status transition is valid.
 */
export function isValidStatusTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Get the next possible statuses for an order.
 */
export function getNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[currentStatus];
}

function cleanText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function humanizeIntent(intent?: string): string {
  if (!intent) return "a property or financing request";
  return intent.replaceAll("_", " ").trim() || "a property or financing request";
}

/**
 * Ensure sales summary fields are always populated for AI conversion paths.
 */
export function buildSalesSummaryFields(input: {
  intent?: string;
  type?: OrderType;
  serviceCategory?: OrderServiceCategory;
  aiHandoffReason?: string;
  customerNeedsSummary?: string;
  salesTalkingPoints?: string;
  recommendationSummary?: string;
}): SalesSummaryFields {
  const requestLabel = input.serviceCategory
    ? humanizeIntent(input.serviceCategory)
    : input.intent
      ? humanizeIntent(input.intent)
      : input.type === "loan"
        ? "loan consultation"
        : "property support";

  const recommendationSummary =
    cleanText(input.recommendationSummary) ??
    `AI qualified this lead for ${requestLabel} and prepared it for sales follow-up.`;
  const customerNeedsSummary =
    cleanText(input.customerNeedsSummary) ??
    `Customer is interested in ${requestLabel} and expects clear options with next steps.`;
  const aiHandoffReason =
    cleanText(input.aiHandoffReason) ??
    `Lead is qualified for sales because the customer requested ${requestLabel} and is ready for guided follow-up.`;
  const salesTalkingPoints =
    cleanText(input.salesTalkingPoints) ??
    "Contact the customer, confirm key constraints, and propose the next best action to close.";

  return {
    aiHandoffReason,
    customerNeedsSummary,
    salesTalkingPoints,
    recommendationSummary,
  };
}

export function inferReasonCategory(input: {
  type?: OrderType;
  serviceCategory?: OrderServiceCategory;
  intent?: string;
}): ConversationReasonCategory {
  if (input.serviceCategory) return input.serviceCategory;
  const intent = input.intent?.toLowerCase() ?? "";
  if (intent.includes("sell") || intent.includes("بيع")) return "sell_property";
  if (intent.includes("search") || intent.includes("browse") || intent.includes("بحث"))
    return "property_search";
  if (intent.includes("loan") || intent.includes("finance") || intent.includes("قرض"))
    return "loan_consultation";
  return input.type === "loan" ? "loan_consultation" : "buy_property";
}

export function extractTopics(input: {
  intent?: string;
  customerNeedsSummary?: string;
  salesTalkingPoints?: string;
}): string[] {
  const raw = [input.intent, input.customerNeedsSummary, input.salesTalkingPoints]
    .filter(Boolean)
    .join("\n");
  const items = raw
    .split(/\n|,|;|،|•|-/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  return Array.from(new Set(items)).slice(0, 8);
}
