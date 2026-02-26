/**
 * Admin dashboard - stats, chart data, top searched areas.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";

export const overviewStats = query({
  args: {},
  returns: v.object({
    userProfiles: v.number(),
    partners: v.number(),
    banks: v.number(),
    properties: v.number(),
    handoffsTotal: v.number(),
    handoffsPending: v.number(),
    verifiedPhones: v.number(),
    pendingVerifications: v.number(),
    otpRequests: v.number(),
    sessionTokens: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [
      userProfiles,
      partners,
      banks,
      properties,
      handoffsAll,
      verifiedPhones,
      pendingVerifications,
      otpRequests,
      sessionTokens,
    ] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("partners")
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("banks")
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("properties")
        .collect()
        .then((r) => r.length),
      ctx.db.query("humanHandoffs").collect(),
      ctx.db
        .query("verifiedPhones")
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("pendingVerifications")
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("otpRequests")
        .collect()
        .then((r) => r.length),
      ctx.db
        .query("sessionTokens")
        .collect()
        .then((r) => r.length),
    ]);
    const handoffsPending = handoffsAll.filter(
      (h) => h.status === "pending" || !h.status,
    ).length;
    return {
      userProfiles,
      partners,
      banks,
      properties,
      handoffsTotal: handoffsAll.length,
      handoffsPending,
      verifiedPhones,
      pendingVerifications,
      otpRequests,
      sessionTokens,
    };
  },
});

export const getMyAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAdmin(ctx);
    const [threads, allActivity, recentActivity, handoffs] = await Promise.all([
      ctx.db
        .query("threadMetadata")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userActivity")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userActivity")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10),
      ctx.db
        .query("humanHandoffs")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    return {
      threadCount: threads.length,
      activityCount: allActivity.length,
      handoffsCount: handoffs.length,
      recentActivity: recentActivity.map((a) => ({
        action: a.action,
        channel: a.channel,
        createdAt: a._creationTime,
      })),
    };
  },
});

export const dashboardStats = query({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
  },
  handler: async (ctx, { fromMs, toMs }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const h24 = now - 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;
    const y1 = now - 365 * 24 * 60 * 60 * 1000;
    const startRange = fromMs ?? 0;
    const endRange = toMs ?? now;

    const [
      allUsers,
      allPartners,
      allBanks,
      allProperties,
      allOrders,
      allActivity,
    ] = await Promise.all([
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("partners").collect(),
      ctx.db.query("banks").collect(),
      ctx.db.query("properties").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("userActivity").collect(),
    ]);

    const activeUserIds24h = new Set(
      allActivity.filter((a) => a._creationTime >= h24).map((a) => a.userId),
    );
    const activeUserIds30d = new Set(
      allActivity.filter((a) => a._creationTime >= d30).map((a) => a.userId),
    );
    const activeUserIds1y = new Set(
      allActivity.filter((a) => a._creationTime >= y1).map((a) => a.userId),
    );
    const newUsers30d = allUsers.filter((u) => u._creationTime >= d30).length;
    const messages = allActivity.filter((a) => a.action === "message_sent");
    const messagesByChannel = {
      whatsapp: messages.filter((m) => m.channel === "whatsapp").length,
      app: messages.filter((m) => m.channel === "app").length,
      web: messages.filter((m) => m.channel === "web").length,
    };
    const ordersByStatus: Record<string, number> = {};
    let unassignedOrders = 0;
    let staleOrders = 0;
    const rangedOrders = allOrders.filter(
      (o) => o._creationTime >= startRange && o._creationTime <= endRange,
    );
    for (const o of rangedOrders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
      if (!o.assignedTo) unassignedOrders += 1;
      const isClosed = o.status === "closed_won" || o.status === "closed_lost";
      if (!isClosed && now - o._creationTime >= 48 * 60 * 60 * 1000)
        staleOrders += 1;
    }
    const progressed =
      (ordersByStatus.contacted ?? 0) +
      (ordersByStatus.qualified ?? 0) +
      (ordersByStatus.offer_made ?? 0) +
      (ordersByStatus.under_contract ?? 0) +
      (ordersByStatus.closed_won ?? 0) +
      (ordersByStatus.closed_lost ?? 0);
    const conversionRate =
      progressed > 0 ? (ordersByStatus.closed_won ?? 0) / progressed : 0;

    return {
      totalUsers: allUsers.length,
      activeUsers24h: activeUserIds24h.size,
      activeUsers30d: activeUserIds30d.size,
      activeUsers1y: activeUserIds1y.size,
      newUsers30d,
      totalPartners: allPartners.length,
      totalBanks: allBanks.length,
      totalProperties: allProperties.length,
      totalOrders: allOrders.length,
      ordersByStatus,
      unassignedOrders,
      staleOrders,
      conversionRate,
      messagesByChannel,
    };
  },
});

export const salesActivityFeed = query({
  args: {
    limit: v.optional(v.number()),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 20, fromMs, toMs }) => {
    await requireAdmin(ctx);
    const [activities, orders] = await Promise.all([
      ctx.db.query("userActivity").order("desc").take(limit),
      ctx.db.query("orders").order("desc").take(limit),
    ]);
    const startRange = fromMs ?? 0;
    const endRange = toMs ?? Date.now();
    const feed = [
      ...activities.map((a) => ({
        kind: "activity" as const,
        createdAt: a._creationTime,
        userId: a.userId,
        title: a.action,
        details: a.metadata ?? null,
      })),
      ...orders.map((o) => ({
        kind: "order" as const,
        createdAt: o._creationTime,
        userId: o.userId,
        title: `order_${o.status}`,
        details: { orderId: o._id, type: o.type, status: o.status },
      })),
    ]
      .filter((row) => row.createdAt >= startRange && row.createdAt <= endRange)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
    return feed;
  },
});

export const dashboardChartData = query({
  args: {
    range: v.union(
      v.literal("day"),
      v.literal("week"),
      v.literal("month"),
      v.literal("year"),
    ),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
  },
  handler: async (ctx, { range, fromMs, toMs }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let startTime: number;
    let bucketMs: number;
    let bucketCount: number;

    if (fromMs !== undefined || toMs !== undefined) {
      startTime = fromMs ?? now - 7 * 24 * 60 * 60 * 1000;
      const endTime = toMs ?? now;
      const duration = Math.max(60 * 60 * 1000, endTime - startTime);
      if (duration <= 48 * 60 * 60 * 1000) {
        bucketMs = 60 * 60 * 1000;
      } else if (duration <= 90 * 24 * 60 * 60 * 1000) {
        bucketMs = 24 * 60 * 60 * 1000;
      } else {
        bucketMs = 7 * 24 * 60 * 60 * 1000;
      }
      bucketCount = Math.max(1, Math.min(180, Math.ceil(duration / bucketMs)));
    } else {
      switch (range) {
      case "day":
        startTime = now - 24 * 60 * 60 * 1000;
        bucketMs = 60 * 60 * 1000;
        bucketCount = 24;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        bucketMs = 24 * 60 * 60 * 1000;
        bucketCount = 7;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        bucketMs = 24 * 60 * 60 * 1000;
        bucketCount = 30;
        break;
      case "year":
        startTime = now - 365 * 24 * 60 * 60 * 1000;
        bucketMs = 30 * 24 * 60 * 60 * 1000;
        bucketCount = 12;
        break;
      }
    }
    const endTime = toMs ?? now;

    const [allActivity, allUsers, allOrders] = await Promise.all([
      ctx.db.query("userActivity").collect(),
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("orders").collect(),
    ]);

    const recentActivity = allActivity.filter(
      (a) => a._creationTime >= startTime && a._creationTime <= endTime,
    );
    const recentUsers = allUsers.filter(
      (u) => u._creationTime >= startTime && u._creationTime <= endTime,
    );
    const recentOrders = allOrders.filter(
      (o) => o._creationTime >= startTime && o._creationTime <= endTime,
    );

    const messageSeries: number[] = new Array(bucketCount).fill(0);
    const newUserSeries: number[] = new Array(bucketCount).fill(0);
    const orderSeries: number[] = new Array(bucketCount).fill(0);

    for (const a of recentActivity) {
      if (a.action === "message_sent") {
        const idx = Math.min(
          Math.floor((a._creationTime - startTime) / bucketMs),
          bucketCount - 1,
        );
        if (idx >= 0) messageSeries[idx]++;
      }
    }
    for (const u of recentUsers) {
      const idx = Math.min(
        Math.floor((u._creationTime - startTime) / bucketMs),
        bucketCount - 1,
      );
      if (idx >= 0) newUserSeries[idx]++;
    }
    for (const o of recentOrders) {
      const idx = Math.min(
        Math.floor((o._creationTime - startTime) / bucketMs),
        bucketCount - 1,
      );
      if (idx >= 0) orderSeries[idx]++;
    }

    return {
      range,
      bucketCount,
      messageSeries,
      newUserSeries,
      orderSeries,
    };
  },
});

export const topSearchedAreas = query({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
  },
  handler: async (ctx, { fromMs, toMs }) => {
    await requireAdmin(ctx);
    const logs = await ctx.db.query("searchLogs").collect();
    const filteredLogs = logs.filter((log) => {
      if (fromMs !== undefined && log._creationTime < fromMs) return false;
      if (toMs !== undefined && log._creationTime > toMs) return false;
      return true;
    });
    const counts: Record<string, number> = {};
    for (const log of filteredLogs) {
      if (log.location) {
        counts[log.location] = (counts[log.location] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }));
  },
});

export const aiTokenUsageStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;

    const usageRows = await ctx.db.query("aiTokenUsage").collect();

    if (usageRows.length === 0) {
      return {
        totalRequests: 0,
        estimatedPromptTokens: 0,
        estimatedCompletionTokens: 0,
        estimatedTotalTokens: 0,
        modelUsage: [],
        weeklyRequests: 0,
      };
    }

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalRequests = 0;
    const modelUsageMap: Record<
      string,
      { prompt: number; completion: number; requests: number }
    > = {};

    for (const row of usageRows) {
      totalPromptTokens += row.promptTokens;
      totalCompletionTokens += row.completionTokens;
      totalRequests++;
      if (!modelUsageMap[row.model]) {
        modelUsageMap[row.model] = { prompt: 0, completion: 0, requests: 0 };
      }
      modelUsageMap[row.model].prompt += row.promptTokens;
      modelUsageMap[row.model].completion += row.completionTokens;
      modelUsageMap[row.model].requests++;
    }

    const weeklyRequests = usageRows.filter(
      (r) => r._creationTime >= last7Days,
    ).length;

    return {
      totalRequests,
      estimatedPromptTokens: totalPromptTokens,
      estimatedCompletionTokens: totalCompletionTokens,
      estimatedTotalTokens: totalPromptTokens + totalCompletionTokens,
      modelUsage: Object.entries(modelUsageMap).map(([model, data]) => ({
        model,
        requests: data.requests,
        estimatedTokens: data.prompt + data.completion,
        promptTokens: data.prompt,
        completionTokens: data.completion,
      })),
      weeklyRequests,
    };
  },
});

export const searchAnalyticsStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const searchLogs = await ctx.db.query("searchLogs").collect();
    const knowledgeResearch = await ctx.db.query("knowledgeResearch").collect();

    // Most searched areas
    const locationCounts: Record<string, number> = {};
    for (const log of searchLogs) {
      if (log.location) {
        locationCounts[log.location] = (locationCounts[log.location] || 0) + 1;
      }
    }

    // Most searched queries
    const queryCounts: Record<string, number> = {};
    for (const log of searchLogs) {
      if (log.query) {
        queryCounts[log.query] = (queryCounts[log.query] || 0) + 1;
      }
    }

    // Search by channel
    const channelCounts = { whatsapp: 0, app: 0, web: 0 };
    for (const log of searchLogs) {
      if (log.channel) {
        channelCounts[log.channel]++;
      }
    }

    // Search by result type (property, bank, etc)
    const resultTypeCounts: Record<string, number> = {};
    for (const log of searchLogs) {
      if (log.resultCount && log.resultCount > 0) {
        const type = (log as any).resultType || "unknown";
        resultTypeCounts[type] = (resultTypeCounts[type] || 0) + 1;
      }
    }

    return {
      totalSearches: searchLogs.length,
      topLocations: Object.entries(locationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([location, count]) => ({ location, count })),
      topQueries: Object.entries(queryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([query, count]) => ({ query, count })),
      byChannel: channelCounts,
      byResultType: resultTypeCounts,
    };
  },
});

/**
 * AI token usage chart data by time bucket.
 */
export const aiUsageChartData = query({
  args: {
    range: v.union(
      v.literal("day"),
      v.literal("week"),
      v.literal("month"),
      v.literal("year"),
    ),
  },
  handler: async (ctx, { range }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let startTime: number;
    let bucketMs: number;
    let bucketCount: number;

    switch (range) {
      case "day":
        startTime = now - 24 * 60 * 60 * 1000;
        bucketMs = 60 * 60 * 1000;
        bucketCount = 24;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        bucketMs = 24 * 60 * 60 * 1000;
        bucketCount = 7;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        bucketMs = 24 * 60 * 60 * 1000;
        bucketCount = 30;
        break;
      case "year":
        startTime = now - 365 * 24 * 60 * 60 * 1000;
        bucketMs = 30 * 24 * 60 * 60 * 1000;
        bucketCount = 12;
        break;
    }

    const usageRows = await ctx.db.query("aiTokenUsage").collect();

    const tokensSeries: number[] = new Array(bucketCount).fill(0);
    const requestsSeries: number[] = new Array(bucketCount).fill(0);

    for (const row of usageRows) {
      if (row._creationTime >= startTime) {
        const idx = Math.min(
          Math.floor((row._creationTime - startTime) / bucketMs),
          bucketCount - 1,
        );
        if (idx >= 0) {
          requestsSeries[idx]++;
          tokensSeries[idx] += row.totalTokens;
        }
      }
    }

    return {
      range,
      bucketCount,
      tokensSeries,
      requestsSeries,
    };
  },
});
