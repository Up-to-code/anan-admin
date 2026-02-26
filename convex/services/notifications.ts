/**
 * Notification service - internal emitters for sales lifecycle events.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { buildNotificationTemplate } from "./notificationManifest";

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

export const createOrderMentionNotifications = internalMutation({
  args: {
    userIds: v.array(v.string()),
    orderId: v.id("orders"),
    actorName: v.optional(v.string()),
    mentionNote: v.optional(v.string()),
  },
  handler: async (ctx, { userIds, orderId, actorName, mentionNote }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return { sent: 0 };
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    let sent = 0;
    for (const userId of uniqueUserIds) {
      const payload = buildNotificationTemplate({
        event: "order_mentioned",
        order,
        actorName,
        mentionNote,
      });
      await ctx.db.insert("notifications", {
        userId,
        title: payload.title,
        body: payload.body,
        read: false,
        type: "order_mention",
        linkId: String(order._id),
        audience: payload.audience,
        entityType: "order",
        entityId: String(order._id),
        priority: payload.priority,
        actionRequired: payload.actionRequired,
        status: "new",
        metadata: {
          ...(payload.metadata ?? {}),
          orderId: String(order._id),
          mentionedBy: actorName,
        },
      });
      sent += 1;
    }
    return { sent };
  },
});
