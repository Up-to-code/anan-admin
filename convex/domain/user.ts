/**
 * User domain types and validators.
 */
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type UserSource = "whatsapp" | "app" | "web";

export type UserRole = "user" | "admin";

export type UserProfile = Doc<"userProfiles">;

export interface UserProfileCreateInput {
  userId: string;
  name?: string;
  phone?: string;
  email?: string;
  salary?: number;
  employment?: string;
  firstTimeBuyer?: boolean;
  kids?: number;
  minBeds?: number;
  maxBudget?: number;
  preferredLocation?: string;
  notes?: string;
  verified?: boolean;
  source?: UserSource;
  planType?: "free" | "paid";
  planExpiresAt?: number;
  chatLimit?: number;
}

export interface UserProfileUpdateInput {
  name?: string;
  phone?: string;
  email?: string;
  salary?: number;
  employment?: string;
  firstTimeBuyer?: boolean;
  kids?: number;
  minBeds?: number;
  maxBudget?: number;
  preferredLocation?: string;
  notes?: string;
  verified?: boolean;
  planType?: "free" | "paid";
  planExpiresAt?: number;
  chatLimit?: number;
}

// ============================================================================
// Validators
// ============================================================================

export const userSourceValidator = v.union(
  v.literal("whatsapp"),
  v.literal("app"),
  v.literal("web")
);

export const userRoleValidator = v.union(
  v.literal("user"),
  v.literal("admin")
);

export const userProfileCreateArgsValidator = {
  userId: v.string(),
  name: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  salary: v.optional(v.number()),
  employment: v.optional(v.string()),
  firstTimeBuyer: v.optional(v.boolean()),
  kids: v.optional(v.number()),
  minBeds: v.optional(v.number()),
  maxBudget: v.optional(v.number()),
  preferredLocation: v.optional(v.string()),
  notes: v.optional(v.string()),
  verified: v.optional(v.boolean()),
  source: v.optional(userSourceValidator),
  planType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
  planExpiresAt: v.optional(v.number()),
  chatLimit: v.optional(v.number()),
};

export const userProfileUpdateArgsValidator = {
  name: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  salary: v.optional(v.number()),
  employment: v.optional(v.string()),
  firstTimeBuyer: v.optional(v.boolean()),
  kids: v.optional(v.number()),
  minBeds: v.optional(v.number()),
  maxBudget: v.optional(v.number()),
  preferredLocation: v.optional(v.string()),
  notes: v.optional(v.string()),
  verified: v.optional(v.boolean()),
  planType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
  planExpiresAt: v.optional(v.number()),
  chatLimit: v.optional(v.number()),
};

// ============================================================================
// Return type validators
// ============================================================================

export const userProfileReturnValidator = v.object({
  _id: v.id("userProfiles"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  salary: v.optional(v.number()),
  employment: v.optional(v.string()),
  firstTimeBuyer: v.optional(v.boolean()),
  kids: v.optional(v.number()),
  minBeds: v.optional(v.number()),
  maxBudget: v.optional(v.number()),
  preferredLocation: v.optional(v.string()),
  notes: v.optional(v.string()),
  verified: v.optional(v.boolean()),
  source: v.optional(userSourceValidator),
  planType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
  planExpiresAt: v.optional(v.number()),
  chatLimit: v.optional(v.number()),
});

export const userProfileListReturnValidator = v.array(userProfileReturnValidator);

// Activity types
export const userActivityActionValidator = v.union(
  v.literal("message_sent"),
  v.literal("search"),
  v.literal("order_created"),
  v.literal("login"),
  v.literal("property_viewed")
);

export const userActivityReturnValidator = v.object({
  _id: v.id("userActivity"),
  _creationTime: v.number(),
  userId: v.string(),
  action: userActivityActionValidator,
  channel: v.optional(userSourceValidator),
  metadata: v.optional(v.any()),
});

// Notification types
export const notificationReturnValidator = v.object({
  _id: v.id("notifications"),
  _creationTime: v.number(),
  userId: v.string(),
  title: v.string(),
  body: v.optional(v.string()),
  read: v.boolean(),
  type: v.optional(v.string()),
  linkId: v.optional(v.string()),
});

// Favorite types
export const favoriteReturnValidator = v.object({
  _id: v.id("favorites"),
  _creationTime: v.number(),
  userId: v.string(),
  propertyId: v.id("properties"),
});
