/**
 * Admin users - list, get, set role, enrich with phone/role.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { requireAdmin, getUserRoleByPhone } from "../lib/auth";
import { authComponent } from "../auth";
import { normalizePhone } from "../lib/phone";
import { ROLE_ADMIN, ROLE_USER, roleValidator } from "../roles";

/** Synthetic profile shape for users who exist in Better Auth but not in userProfiles */
type SyntheticProfile = {
  _id: "synthetic";
  _creationTime: number;
  userId: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  verified?: boolean;
  source?: "whatsapp" | "app" | "web";
};

/** Fetch Better Auth users and merge with userProfiles. Returns merged list. */
async function fetchMergedUserList(
  ctx: QueryCtx,
  limit: number
): Promise<Array<Doc<"userProfiles"> | SyntheticProfile>> {
  const [profilesResult, baResult] = await Promise.all([
    ctx.db.query("userProfiles").order("desc").take(limit * 2),
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { numItems: 500, cursor: null },
      sortBy: { field: "createdAt", direction: "desc" },
    }),
  ]);

  const profileByUserId = new Map(
    profilesResult.map((p) => [p.userId, p] as const)
  );
  const profiles = profilesResult;

  const baPage =
    Array.isArray(baResult)
      ? baResult
      : ((baResult as { page?: unknown[] })?.page ?? []);
  const synthetic: SyntheticProfile[] = [];
  for (const ba of baPage) {
    const userId = String(ba._id);
    if (profileByUserId.has(userId)) continue;
    synthetic.push({
      _id: "synthetic",
      _creationTime: (ba as { createdAt?: number }).createdAt ?? 0,
      userId,
      name: (ba as { name?: string }).name ?? null,
      phone: (ba as { phoneNumber?: string }).phoneNumber ?? null,
      email: (ba as { email?: string }).email ?? null,
      verified: (ba as { emailVerified?: boolean }).emailVerified ?? false,
    });
  }

  const merged = [...profiles, ...synthetic];
  merged.sort((a, b) => b._creationTime - a._creationTime);
  return merged.slice(0, limit);
}

/** Same as fetchMergedUserList but returns full merged list for pagination */
async function fetchAllMergedUsers(
  ctx: QueryCtx
): Promise<Array<Doc<"userProfiles"> | SyntheticProfile>> {
  const [profilesResult, baResult] = await Promise.all([
    ctx.db.query("userProfiles").order("desc").collect(),
    ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { numItems: 1000, cursor: null },
      sortBy: { field: "createdAt", direction: "desc" },
    }),
  ]);

  const profileByUserId = new Map(
    profilesResult.map((p) => [p.userId, p] as const)
  );
  const baPage =
    Array.isArray(baResult)
      ? baResult
      : ((baResult as { page?: unknown[] })?.page ?? []);
  const synthetic: SyntheticProfile[] = [];
  for (const ba of baPage) {
    const userId = String(ba._id);
    if (profileByUserId.has(userId)) continue;
    synthetic.push({
      _id: "synthetic",
      _creationTime: (ba as { createdAt?: number }).createdAt ?? 0,
      userId,
      name: (ba as { name?: string }).name ?? null,
      phone: (ba as { phoneNumber?: string }).phoneNumber ?? null,
      email: (ba as { email?: string }).email ?? null,
      verified: (ba as { emailVerified?: boolean }).emailVerified ?? false,
    });
  }
  const merged = [...profilesResult, ...synthetic];
  merged.sort((a, b) => b._creationTime - a._creationTime);
  return merged;
}

async function enrichUsersWithPhoneAndRole(
  ctx: QueryCtx,
  users: Array<{ userId: string; phone?: string | null }>
): Promise<
  Array<{ userId: string; phoneNumber: string | null; role: "user" | "admin" }>
> {
  const userIds = users.map((u) => u.userId);

  const profileRoleByUserId = new Map<string, "user" | "admin">(
    (await ctx.db.query("userProfiles").collect())
      .filter((p) => userIds.includes(p.userId) && p.role !== undefined)
      .map((p) => [p.userId, p.role as "user" | "admin"]),
  );

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

  const adminUserIds = new Set(
    (await ctx.db.query("adminUsers").collect()).map((a) => a.userId)
  );

  return users.map((u) => {
    const profileRole = profileRoleByUserId.get(u.userId);
    if (profileRole === ROLE_ADMIN) {
      const phoneNumber = verifiedByUserId.get(u.userId) ?? u.phone ?? null;
      return { userId: u.userId, phoneNumber, role: ROLE_ADMIN };
    }
    if (adminUserIds.has(u.userId)) {
      const phoneNumber = verifiedByUserId.get(u.userId) ?? u.phone ?? null;
      return { userId: u.userId, phoneNumber, role: ROLE_ADMIN };
    }
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
    const page = await fetchMergedUserList(ctx, limit);

    const enrichedData = await enrichUsersWithPhoneAndRole(
      ctx,
      page.map((u) => ({ userId: u.userId, phone: u.phone ?? undefined }))
    );
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
    const merged = await fetchAllMergedUsers(ctx);
    const numItems = args.paginationOpts.numItems ?? 20;
    const cursor = args.paginationOpts.cursor;
    const offset = cursor ? parseInt(cursor, 10) || 0 : 0;
    const page = merged.slice(offset, offset + numItems);
    const isDone = offset + numItems >= merged.length;
    const continueCursor = isDone ? null : String(offset + numItems);

    const enrichedData = await enrichUsersWithPhoneAndRole(
      ctx,
      page.map((u) => ({ userId: u.userId, phone: u.phone ?? undefined }))
    );
    const enrichedMap = new Map(enrichedData.map((e) => [e.userId, e]));

    const pageWithPhoneAndRole = page.map((u) => {
      const enriched = enrichedMap.get(u.userId);
      return {
        ...u,
        phoneNumber: enriched?.phoneNumber ?? null,
        role: enriched?.role ?? "user",
      };
    });

    return {
      page: pageWithPhoneAndRole,
      isDone,
      continueCursor,
    };
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
    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const phoneNumber = verified ? verified.phoneNumber : null;
    const roleFromPhone = phoneNumber
      ? await getUserRoleByPhone(ctx, phoneNumber)
      : ("user" as const);

    if (profile) {
      const legacyAdmin = await ctx.db
        .query("adminUsers")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .first();
      const role =
        profile.role ??
        (roleFromPhone === ROLE_ADMIN || legacyAdmin ? ROLE_ADMIN : roleFromPhone);
      return {
        ...profile,
        phoneNumber,
        phone: phoneNumber ?? profile.phone ?? null,
        role,
      };
    }

    const baUser = await authComponent.getAnyUserById(ctx, userId);
    if (!baUser) return null;
    const legacyAdmin = await ctx.db
      .query("adminUsers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    return {
      userId,
      name: (baUser as { name?: string }).name ?? null,
      phone: phoneNumber ?? (baUser as { phoneNumber?: string }).phoneNumber ?? null,
      phoneNumber: phoneNumber ?? (baUser as { phoneNumber?: string }).phoneNumber ?? null,
      email: (baUser as { email?: string }).email ?? null,
      role: legacyAdmin || roleFromPhone === ROLE_ADMIN ? ROLE_ADMIN : ROLE_USER,
      verified: (baUser as { emailVerified?: boolean }).emailVerified ?? false,
      _creationTime:
        (baUser as { createdAt?: number }).createdAt ?? Date.now(),
    };
  },
});

export const getUser = usersGetByUserId;

export const listTeamMembers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const seen = new Set<string>();
    const members: Array<{
      userId: string;
      name?: string | null;
      phone: string | null;
      email?: string | null;
      role: "user" | "admin";
      canEditRole: boolean;
    }> = [];

    // 1. userRoles where role === "admin" -> resolve phone -> verifiedPhones -> userId -> userProfiles
    const adminRoles = await ctx.db.query("userRoles").collect();
    const adminPhones = new Set(
      adminRoles.filter((r) => r.role === "admin").map((r) => r.phoneNumber),
    );

    const allVerified = await ctx.db.query("verifiedPhones").collect();
    const userIdByPhone = new Map<string, string>();
    for (const v of allVerified) {
      if (v.userId && v.phoneNumber) {
        const norm = normalizePhone(v.phoneNumber);
        if (!userIdByPhone.has(norm)) userIdByPhone.set(norm, v.userId);
      }
    }

    const allProfiles = await ctx.db.query("userProfiles").collect();
    const profileByUserId = new Map(allProfiles.map((p) => [p.userId, p]));

    for (const profile of allProfiles) {
      if (profile.role !== ROLE_ADMIN || seen.has(profile.userId)) continue;
      seen.add(profile.userId);
      const verified = allVerified.find((v) => v.userId === profile.userId);
      const phone = verified?.phoneNumber
        ? normalizePhone(verified.phoneNumber)
        : profile.phone
          ? normalizePhone(profile.phone)
          : null;
      members.push({
        userId: profile.userId,
        name: profile.name ?? null,
        phone,
        email: profile.email ?? null,
        role: ROLE_ADMIN,
        canEditRole: true,
      });
    }

    for (const phone of adminPhones) {
      const userId = userIdByPhone.get(phone);
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      const profile = profileByUserId.get(userId);
      members.push({
        userId,
        name: profile?.name ?? null,
        phone,
        email: profile?.email ?? null,
        role: "admin",
        canEditRole: true,
      });
    }

    // 2. adminUsers (email-based) - fetch BA when profile missing name/email
    const baResult = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { numItems: 500, cursor: null },
    });
    const baPage =
      Array.isArray(baResult)
        ? baResult
        : ((baResult as { page?: unknown[] })?.page ?? []);
    const baByUserId = new Map(
      baPage.map((u: { _id: string }) => [String(u._id), u] as const)
    );

    const legacyAdmins = await ctx.db.query("adminUsers").collect();
    for (const { userId } of legacyAdmins) {
      if (seen.has(userId)) continue;
      seen.add(userId);
      const profile = profileByUserId.get(userId);
      const baUser = baByUserId.get(userId) as
        | { name?: string; email?: string; phoneNumber?: string }
        | undefined;
      const verified = allVerified.find((v) => v.userId === userId);
      const phone = verified?.phoneNumber
        ? normalizePhone(verified.phoneNumber)
        : baUser?.phoneNumber ?? null;
      members.push({
        userId,
        name: profile?.name ?? baUser?.name ?? null,
        phone,
        email: profile?.email ?? baUser?.email ?? null,
        role: "admin",
        canEditRole: true,
      });
    }

    members.sort((a, b) =>
      (a.name || a.userId).localeCompare(b.name || b.userId),
    );
    return members;
  },
});

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
    let roleDocId: any;
    if (existing) {
      await ctx.db.patch(existing._id, { role });
      roleDocId = existing._id;
    } else {
      roleDocId = await ctx.db.insert("userRoles", { phoneNumber: normalized, role });
    }

    // Keep userProfiles/adminUsers in sync for any users linked to this phone.
    const verifiedRows = await ctx.db
      .query("verifiedPhones")
      .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
      .collect();

    for (const row of verifiedRows) {
      if (!row.userId) continue;
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("userId", (q) => q.eq("userId", row.userId!))
        .first();
      if (profile) {
        await ctx.db.patch(profile._id, { role });
      } else {
        await ctx.db.insert("userProfiles", { userId: row.userId, role });
      }

      const adminRow = await ctx.db
        .query("adminUsers")
        .withIndex("userId", (q) => q.eq("userId", row.userId!))
        .first();
      if (role === ROLE_ADMIN && !adminRow) {
        await ctx.db.insert("adminUsers", { userId: row.userId });
      }
      if (role === ROLE_USER && adminRow) {
        await ctx.db.delete(adminRow._id);
      }
    }

    return roleDocId;
  },
});

export const setUserRoleByUserId = mutation({
  args: {
    userId: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, { userId, role }) => {
    await requireAdmin(ctx);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, { role });
    } else {
      await ctx.db.insert("userProfiles", { userId, role });
    }

    // If the user has a verified phone, sync role in the phone-based role table too.
    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (verified?.phoneNumber) {
      const normalized = normalizePhone(verified.phoneNumber);
      const roleRow = await ctx.db
        .query("userRoles")
        .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
        .first();
      if (roleRow) {
        await ctx.db.patch(roleRow._id, { role });
      } else {
        await ctx.db.insert("userRoles", { phoneNumber: normalized, role });
      }
    }

    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (role === ROLE_ADMIN) {
      if (existing) return existing._id;
      return await ctx.db.insert("adminUsers", { userId });
    }
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
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

    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      const baUser = await authComponent.getAnyUserById(ctx, userId);
      if (!baUser) return null;
      const legacyAdmin = await ctx.db
        .query("adminUsers")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .first();
      const phoneNumber = (baUser as { phoneNumber?: string }).phoneNumber ?? null;
      const roleFromPhone = phoneNumber
        ? await getUserRoleByPhone(ctx, phoneNumber)
        : ROLE_USER;
      const role = legacyAdmin || roleFromPhone === ROLE_ADMIN ? ROLE_ADMIN : ROLE_USER;
      const minimalProfile = {
        userId,
        name: (baUser as { name?: string }).name ?? null,
        phone: phoneNumber,
        phoneNumber,
        email: (baUser as { email?: string }).email ?? null,
        role,
      };
      return {
        profile: minimalProfile,
        orders: [],
        favorites: [],
        reviews: [],
        notifications: [],
        activity: [],
        conversationReasons: [],
        searchLogs: [],
        knowledgeResearch: [],
        threads: [],
        handoffs: [],
        counts: {
          orders: 0,
          favorites: 0,
          reviews: 0,
          notifications: 0,
          searchLogs: 0,
          knowledgeResearch: 0,
          threads: 0,
          handoffs: 0,
        },
      };
    }

    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const phoneNumber = verified?.phoneNumber ?? null;
    const roleFromPhone = phoneNumber
      ? await getUserRoleByPhone(ctx, phoneNumber)
      : ROLE_USER;
    const legacyAdmin = await ctx.db
      .query("adminUsers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    const role = profile.role ?? (legacyAdmin || roleFromPhone === ROLE_ADMIN ? ROLE_ADMIN : ROLE_USER);

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
