/**
 * Admin users - list, get, set role, enrich with phone/role.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx } from "../_generated/server";
import { requireAdmin, getUserRoleByPhone } from "../lib/auth";
import { normalizePhone } from "../lib/phone";
import { roleValidator } from "../roles";

async function enrichUsersWithPhoneAndRole(
  ctx: QueryCtx,
  users: Array<{ userId: string; phone?: string | null }>
): Promise<
  Array<{ userId: string; phoneNumber: string | null; role: "user" | "admin" }>
> {
  const userIds = users.map((u) => u.userId);

  const allVerifiedPhones = await ctx.db.query("verifiedPhones").collect();
  const verifiedByUserId = new Map<string, string>();
  for (const rec of allVerifiedPhones) {
    if (rec.userId && userIds.includes(rec.userId)) {
      verifiedByUserId.set(rec.userId, rec.phoneNumber);
    }
  }

  const phoneNumbers = new Set<string>();
  for (const user of users) {
    const phone = verifiedByUserId.get(user.userId) ?? user.phone;
    if (phone) {
      phoneNumbers.add(normalizePhone(phone));
    }
  }

  const allRoles = await ctx.db.query("userRoles").collect();
  const roleByPhone = new Map<string, "user" | "admin">();
  for (const r of allRoles) {
    if (phoneNumbers.has(r.phoneNumber)) {
      roleByPhone.set(r.phoneNumber, r.role);
    }
  }

  return users.map((u) => {
    const phoneNumber = verifiedByUserId.get(u.userId) ?? null;
    const normalizedPhone = phoneNumber
      ? normalizePhone(phoneNumber)
      : u.phone
        ? normalizePhone(u.phone)
        : null;
    const role = normalizedPhone
      ? (roleByPhone.get(normalizedPhone) ?? "user")
      : "user";
    return { userId: u.userId, phoneNumber, role };
  });
}

export const listUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    await requireAdmin(ctx);
    const page = await ctx.db
      .query("userProfiles")
      .order("desc")
      .take(limit);

    const enrichedData = await enrichUsersWithPhoneAndRole(ctx, page);
    const enrichedMap = new Map(enrichedData.map((e) => [e.userId, e]));

    const [activities, orders] = await Promise.all([
      ctx.db.query("userActivity").order("desc").take(200),
      ctx.db.query("orders").order("desc").take(100),
    ]);

    const lastActivityMap = new Map<
      string,
      { createdAt: number; action: string }
    >();

    for (const a of activities) {
      const existing = lastActivityMap.get(a.userId);
      const ts = a._creationTime;
      if (!existing || ts > existing.createdAt) {
        lastActivityMap.set(a.userId, { createdAt: ts, action: a.action });
      }
    }
    for (const o of orders) {
      const existing = lastActivityMap.get(o.userId);
      const ts = o._creationTime;
      const action = "order_created";
      if (!existing || ts > existing.createdAt) {
        lastActivityMap.set(o.userId, { createdAt: ts, action });
      }
    }

    const withActivity = page.map((u) => {
      const enriched = enrichedMap.get(u.userId);
      const last = lastActivityMap.get(u.userId);
      return {
        ...u,
        phone: enriched?.phoneNumber ?? u.phone ?? null,
        phoneNumber: enriched?.phoneNumber ?? null,
        role: enriched?.role ?? "user",
        lastActivityAt: last?.createdAt,
        lastAction: last?.action,
      };
    });

    withActivity.sort((a, b) => {
      const atA = a.lastActivityAt ?? 0;
      const atB = b.lastActivityAt ?? 0;
      if (atA !== atB) return atB - atA;
      return b._creationTime - a._creationTime;
    });

    return withActivity;
  },
});

export const usersList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("userProfiles")
      .order("desc")
      .paginate(args.paginationOpts);

    const enrichedData = await enrichUsersWithPhoneAndRole(ctx, result.page);
    const enrichedMap = new Map(enrichedData.map((e) => [e.userId, e]));

    const pageWithPhoneAndRole = result.page.map((u) => {
      const enriched = enrichedMap.get(u.userId);
      return {
        ...u,
        phoneNumber: enriched?.phoneNumber ?? null,
        role: enriched?.role ?? "user",
      };
    });

    return { ...result, page: pageWithPhoneAndRole };
  },
});

export const usersGetByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const phoneNumber = verified ? verified.phoneNumber : null;
    const role = phoneNumber
      ? await getUserRoleByPhone(ctx, phoneNumber)
      : ("user" as const);
    return {
      ...profile,
      phoneNumber,
      phone: phoneNumber ?? profile.phone ?? null,
      role,
    };
  },
});

export const getUser = usersGetByUserId;

export const setUserRole = mutation({
  args: {
    phoneNumber: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, { phoneNumber, role }) => {
    await requireAdmin(ctx);
    const normalized = normalizePhone(phoneNumber);
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { role });
      return existing._id;
    }
    return await ctx.db.insert("userRoles", { phoneNumber: normalized, role });
  },
});

export const notificationsList = query({
  args: {
    paginationOpts: paginationOptsValidator,
    userId: v.optional(v.string()),
    unreadOnly: v.optional(v.boolean()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let result;
    if (args.userId) {
      result = await ctx.db
        .query("notifications")
        .withIndex("userId", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      result = await ctx.db
        .query("notifications")
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return {
      ...result,
      page: result.page.filter((n) => {
        if (args.unreadOnly && n.read) return false;
        if (args.type && n.type !== args.type) return false;
        return true;
      }),
    };
  },
});

export const notificationAcknowledge = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const notification = await ctx.db.get(id);
    if (!notification) throw new Error("Notification not found");
    await ctx.db.patch(id, { read: true, status: "acknowledged" });
    return null;
  },
});

export const notificationResolve = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const notification = await ctx.db.get(id);
    if (!notification) throw new Error("Notification not found");
    await ctx.db.patch(id, { read: true, status: "resolved", actionRequired: false });
    return null;
  },
});

export const notificationsUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const unread = await ctx.db
      .query("notifications")
      .order("desc")
      .collect();
    return unread.filter((n) => n.audience === "sales" && !n.read).length;
  },
});

export const reviewsList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.query("reviews").order("desc").paginate(args.paginationOpts);
  },
});

export const favoritesList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return ctx.db.query("favorites").order("desc").paginate(args.paginationOpts);
  },
});

export const getUserFullData = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;

    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const phoneNumber = verified?.phoneNumber ?? null;
    const role = phoneNumber
      ? await getUserRoleByPhone(ctx, phoneNumber)
      : "user";

    const orders = await ctx.db
      .query("orders")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const favoriteProperties = await Promise.all(
      favorites.map((f) => ctx.db.get(f.propertyId))
    );

    const reviews = await ctx.db
      .query("reviews")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    const activity = await ctx.db
      .query("userActivity")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    const conversationReasons = await ctx.db
      .query("conversationReasons")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    const searchLogs = await ctx.db
      .query("searchLogs")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    const knowledgeResearch = await ctx.db
      .query("knowledgeResearch")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);

    const threads = await ctx.db
      .query("threadMetadata")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);

    const handoffs = await ctx.db
      .query("humanHandoffs")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);

    return {
      profile: { ...profile, phoneNumber, phone: phoneNumber ?? profile.phone, role },
      orders,
      favorites: favorites.map((f, i) => ({
        ...f,
        property: favoriteProperties[i],
      })),
      reviews,
      notifications,
      activity,
      conversationReasons,
      searchLogs,
      knowledgeResearch,
      threads,
      handoffs,
      counts: {
        orders: orders.length,
        favorites: favorites.length,
        reviews: reviews.length,
        notifications: notifications.filter((n) => !n.read).length,
        searchLogs: searchLogs.length,
        knowledgeResearch: knowledgeResearch.length,
        threads: threads.length,
        handoffs: handoffs.length,
      },
    };
  },
});

export const updateUserProfile = mutation({
  args: {
    profileId: v.id("userProfiles"),
    updates: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
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
    }),
  },
  handler: async (ctx, { profileId, updates }) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get(profileId);
    if (!profile) throw new Error("Profile not found");

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(profileId, cleanUpdates);
    return profileId;
  },
});

export const generateUserSummary = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User not found");

    const [orders, favorites, notifications, activity, searchLogs, conversationReasons, handoffs] = await Promise.all([
      ctx.db.query("orders").withIndex("userId", (q) => q.eq("userId", userId)).order("desc").take(10),
      ctx.db.query("favorites").withIndex("userId", (q) => q.eq("userId", userId)).take(10),
      ctx.db.query("notifications").withIndex("userId", (q) => q.eq("userId", userId)).order("desc").take(10),
      ctx.db.query("userActivity").withIndex("userId", (q) => q.eq("userId", userId)).order("desc").take(20),
      ctx.db.query("searchLogs").withIndex("userId", (q) => q.eq("userId", userId)).order("desc").take(10),
      ctx.db.query("conversationReasons").withIndex("userId", (q) => q.eq("userId", userId)).order("desc").take(5),
      ctx.db.query("humanHandoffs").withIndex("userId", (q) => q.eq("userId", userId)).order("desc").take(5),
    ]);

    const summaryData = {
      profile: {
        name: profile.name || "بدون اسم",
        phone: profile.phone || "-",
        email: profile.email || "-",
        budget: profile.maxBudget || "-",
        location: profile.preferredLocation || "-",
        employment: profile.employment || "-",
        verified: profile.verified ? "موثق" : "غير موثق",
      },
      stats: {
        totalOrders: orders.length,
        totalFavorites: favorites.length,
        unreadNotifications: notifications.filter(n => !n.read).length,
        totalActivity: activity.length,
        totalSearches: searchLogs.length,
      },
      orders: orders.map(o => ({
        status: o.status,
        type: o.type,
        intent: o.intent || "-",
        createdAt: new Date(o._creationTime).toLocaleDateString("ar-SA"),
      })),
      searches: searchLogs.map(s => ({
        query: s.query,
        location: s.location || "-",
        status: s.status || "-",
      })),
      reasons: conversationReasons.map(r => ({
        summary: r.summaryArabic,
        nextAction: r.nextActionArabic,
      })),
      handoffs: handoffs.map(h => ({
        intent: h.intent,
        reason: h.aiHandoffReason || "-",
      })),
    };

    const summaryText = `
# ملخص العميل

## المعلومات الأساسية
- الاسم: ${summaryData.profile.name}
- الهاتف: ${summaryData.profile.phone}
- البريد: ${summaryData.profile.email}
- الميزانية: ${summaryData.profile.budget}
- الموقع المفضل: ${summaryData.profile.location}
- الوظيفة: ${summaryData.profile.employment}
- الحالة: ${summaryData.profile.verified}

## الإحصائيات
- إجمالي الطلبات: ${summaryData.stats.totalOrders}
- المفضلات: ${summaryData.stats.totalFavorites}
- الإشعارات غير المقروءة: ${summaryData.stats.unreadNotifications}
- نشاط عام: ${summaryData.stats.totalActivity}
- عمليات البحث: ${summaryData.stats.totalSearches}

## آخر الطلبات
${summaryData.orders.map(o => `- [${o.status}] ${o.type}: ${o.intent} (${o.createdAt})`).join("\n") || "-"}

## آخرعمليات البحث
${summaryData.searches.map(s => `- "${s.query}" - ${s.location} (${s.status})`).join("\n") || "-"}

## أسباب المحادثات
${summaryData.reasons.map(r => `- ${r.summary} → ${r.nextAction}`).join("\n") || "-"}

## التحويلات
${summaryData.handoffs.map(h => `- ${h.intent}: ${h.reason}`).join("\n") || "-"}
`.trim();

    return {
      summary: summaryText,
      stats: summaryData.stats,
    };
  },
});
