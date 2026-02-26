/**
 * Notification service - internal emitters for sales lifecycle events.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);

const audienceValidator = v.union(
  v.literal("sales"),
  v.literal("admin"),
  v.literal("user")
);

const statusValidator = v.union(
  v.literal("new"),
  v.literal("acknowledged"),
  v.literal("resolved")
);

const entityTypeValidator = v.union(
  v.literal("order"),
  v.literal("handoff"),
  v.literal("customer")
);

/**
 * Create a notification for sales/admin workflows.
 * Internal-only to avoid direct client writes.
 */
export const createSalesNotification = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    type: v.optional(v.string()),
    linkId: v.optional(v.string()),
    audience: v.optional(audienceValidator),
    entityType: v.optional(entityTypeValidator),
    entityId: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    actionRequired: v.optional(v.boolean()),
    status: v.optional(statusValidator),
    metadata: v.optional(v.any()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    return ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.title,
      body: args.body,
      read: false,
      type: args.type ?? "sales",
      linkId: args.linkId,
      audience: args.audience ?? "sales",
      entityType: args.entityType,
      entityId: args.entityId,
      priority: args.priority ?? "medium",
      actionRequired: args.actionRequired ?? true,
      status: args.status ?? "new",
      metadata: args.metadata,
    });
  },
});
