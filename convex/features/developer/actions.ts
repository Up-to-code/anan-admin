import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "../../_generated/server";
import { internal, components, api } from "../../_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import type { Id } from "../../_generated/dataModel";
import { requireAuth } from "../../lib/auth";
import { createDeveloperAgent } from "../../agents/developer/agent";

const developerAgent = createDeveloperAgent({
  developer: {
    stageDeveloperAction: internal.features.developer.actions.stageDeveloperAction,
    listDeveloperActions: api.features.developer.actions.listDeveloperActions,
  },
});

const developerActionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("executed"),
  v.literal("failed"),
);

const developerActionTypeValidator = v.union(
  v.literal("create_listing"),
  v.literal("update_listing"),
  v.literal("delete_listing"),
  v.literal("portfolio_report"),
  v.literal("extract_insights"),
  v.literal("deep_plan"),
  v.literal("other"),
);

function scopedDeveloperUserId(userId: string): string {
  return `developer-${userId}`;
}

function isValidConvexId(value: string): boolean {
  return /^[a-z0-9]{31,37}$/i.test(value);
}

async function assertThreadOwnership(
  ctx: {
    runQuery: Function;
  },
  args: { threadId: string; userId: string },
): Promise<void> {
  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId: args.threadId,
  });
  if (!thread || thread.userId !== scopedDeveloperUserId(args.userId)) {
    throw new Error("Thread not found or access denied");
  }
}

async function executeConfirmedDeveloperAction(
  ctx: MutationCtx,
  actionRow: {
    _id: Id<"developerActions">;
    userId: string;
    actionType:
      | "create_listing"
      | "update_listing"
      | "delete_listing"
      | "portfolio_report"
      | "extract_insights"
      | "deep_plan"
      | "other";
    editablePayload: unknown;
  },
): Promise<Record<string, unknown>> {
  const payload = (actionRow.editablePayload ?? {}) as Record<string, unknown>;

  if (actionRow.actionType === "create_listing") {
    const title = String(payload.title ?? "").trim();
    const address = String(payload.address ?? "").trim();
    const price = Number(payload.price ?? 0);
    const beds = Number(payload.beds ?? 0);
    const baths = Number(payload.baths ?? 0);
    const description = String(payload.description ?? "").trim();
    if (!title || !address || !description || !Number.isFinite(price) || price <= 0) {
      throw new Error("Missing required create listing fields");
    }

    const propertyId = await ctx.db.insert("properties", {
      title,
      address,
      price,
      beds: Number.isFinite(beds) && beds >= 0 ? beds : 0,
      baths: Number.isFinite(baths) && baths >= 0 ? baths : 0,
      description,
      sqft:
        payload.sqft == null || payload.sqft === ""
          ? undefined
          : Number(payload.sqft),
      location: payload.location ? String(payload.location) : undefined,
      area: payload.area ? String(payload.area) : undefined,
      status:
        payload.status === "reserved" || payload.status === "sold"
          ? payload.status
          : "available",
      searchText: [title, address, description, payload.location, payload.area]
        .filter(Boolean)
        .map(String)
        .join(" "),
    });
    await ctx.db.insert("developerPropertyLinks", {
      userId: actionRow.userId,
      propertyId,
      createdAt: Date.now(),
    });
    return { success: true, createdPropertyId: propertyId };
  }

  if (actionRow.actionType === "update_listing") {
    const propertyIdRaw = String(payload.propertyId ?? "").trim();
    if (!propertyIdRaw || !isValidConvexId(propertyIdRaw)) {
      throw new Error("A valid propertyId is required");
    }
    const propertyId = propertyIdRaw as Id<"properties">;
    const ownerLink = await ctx.db
      .query("developerPropertyLinks")
      .withIndex("userId_and_propertyId", (q) =>
        q.eq("userId", actionRow.userId).eq("propertyId", propertyId),
      )
      .first();
    if (!ownerLink) {
      throw new Error("You can only update listings you own");
    }

    const patch: Record<string, unknown> = {};
    const allowed = [
      "title",
      "address",
      "price",
      "beds",
      "baths",
      "description",
      "location",
      "area",
      "sqft",
      "status",
    ] as const;
    for (const key of allowed) {
      if (payload[key] !== undefined) patch[key] = payload[key];
    }
    if (Object.keys(patch).length === 0) {
      return { success: true, skipped: true, reason: "No update fields provided" };
    }
    await ctx.db.patch(propertyId, patch);
    return { success: true, updatedPropertyId: propertyId, updatedFields: Object.keys(patch) };
  }

  if (actionRow.actionType === "delete_listing") {
    const propertyIdRaw = String(payload.propertyId ?? "").trim();
    if (!propertyIdRaw || !isValidConvexId(propertyIdRaw)) {
      return {
        success: true,
        skipped: true,
        reason: "No valid propertyId provided",
      };
    }
    const propertyId = propertyIdRaw as Id<"properties">;
    const ownerLink = await ctx.db
      .query("developerPropertyLinks")
      .withIndex("userId_and_propertyId", (q) =>
        q.eq("userId", actionRow.userId).eq("propertyId", propertyId),
      )
      .first();
    if (!ownerLink) {
      throw new Error("You can only delete listings you own");
    }
    const property = await ctx.db.get(propertyId);
    if (!property) {
      return { success: true, skipped: true, reason: "Property not found" };
    }
    await ctx.db.delete(propertyId);
    await ctx.db.delete(ownerLink._id);
    return { success: true, deletedPropertyId: propertyId };
  }

  if (actionRow.actionType === "portfolio_report") {
    const links = await ctx.db
      .query("developerPropertyLinks")
      .withIndex("userId", (q) => q.eq("userId", actionRow.userId))
      .collect();

    const properties = (
      await Promise.all(links.map((link) => ctx.db.get(link.propertyId)))
    ).filter((row): row is NonNullable<typeof row> => Boolean(row));

    const total = properties.length;
    const available = properties.filter((p) => (p.status ?? "available") === "available").length;
    const reserved = properties.filter((p) => p.status === "reserved").length;
    const sold = properties.filter((p) => p.status === "sold").length;
    const averagePrice =
      total > 0
        ? Math.round(properties.reduce((sum, p) => sum + Number(p.price || 0), 0) / total)
        : 0;

    return {
      success: true,
      reportType: payload.reportType ?? "overview",
      summary: {
        totalListings: total,
        available,
        reserved,
        sold,
        averagePrice,
      },
    };
  }

  if (actionRow.actionType === "extract_insights") {
    const goal = String(payload.goal ?? "Insight extraction");
    const sourceText = String(payload.sourceText ?? "");
    const bullets = sourceText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);
    return {
      success: true,
      goal,
      insights: bullets.length > 0 ? bullets : ["No detailed source text provided."],
    };
  }

  if (actionRow.actionType === "deep_plan") {
    const goal = String(payload.goal ?? "Execution plan");
    const scope = String(payload.scope ?? "General");
    const deliverables = Array.isArray(payload.deliverables)
      ? payload.deliverables.map(String).slice(0, 8)
      : [];
    const milestones = Array.isArray(payload.milestones)
      ? payload.milestones.map(String).slice(0, 8)
      : [];

    return {
      success: true,
      plan: {
        goal,
        scope,
        phase1: "Discovery and baseline audit",
        phase2: "Implementation and incremental validation",
        phase3: "Launch readiness and monitoring",
        milestones,
        deliverables,
      },
    };
  }

  return { success: true, note: "Action acknowledged." };
}

export const createDeveloperThreadAction = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, { title }) => {
    const userId = await requireAuth(ctx);
    const threadId = await createThread(ctx, components.agent, {
      userId: scopedDeveloperUserId(userId),
      title: title ?? "Developer workspace",
    });
    return { threadId };
  },
});

export const sendDeveloperMessage = mutation({
  args: {
    threadId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { threadId, body }) => {
    const userId = await requireAuth(ctx);
    await assertThreadOwnership(ctx, { threadId, userId });

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: body,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.features.developer.actions.generateDeveloperResponse,
      {
        threadId,
        promptMessageId: messageId,
        userId,
      },
    );
  },
});

export const generateDeveloperResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId, userId }) => {
    await developerAgent.streamText(
      ctx,
      { threadId, userId } as any,
      { promptMessageId } as any,
      { saveStreamDeltas: true },
    );
  },
});

export const getDeveloperThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertThreadOwnership(ctx, { threadId: args.threadId, userId });

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });
    return { ...paginated, streams };
  },
});

export const listDeveloperThreads = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await requireAuth(ctx);
    return await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: scopedDeveloperUserId(userId),
      paginationOpts,
    });
  },
});

export const searchDeveloperThreads = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query: searchQuery, limit = 50 }) => {
    const userId = await requireAuth(ctx);
    return await ctx.runQuery(components.agent.threads.searchThreadTitles, {
      userId: scopedDeveloperUserId(userId),
      query: searchQuery,
      limit,
    });
  },
});

export const deleteDeveloperThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const userId = await requireAuth(ctx);
    await assertThreadOwnership(ctx, { threadId, userId });
    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId,
    });
    return { success: true };
  },
});

export const stageDeveloperAction = internalMutation({
  args: {
    threadId: v.string(),
    userId: v.string(),
    actionType: developerActionTypeValidator,
    title: v.string(),
    draftPayload: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("developerActions", {
      threadId: args.threadId,
      userId: args.userId,
    actionType: args.actionType,
      title: args.title,
      status: "pending",
      draftPayload: args.draftPayload,
      editablePayload: args.draftPayload,
    });
  },
});

export const listDeveloperActions = query({
  args: {
    threadId: v.string(),
    status: v.optional(developerActionStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await assertThreadOwnership(ctx, { threadId: args.threadId, userId });

    if (args.status) {
      return await ctx.db
        .query("developerActions")
        .withIndex("threadId_and_status", (q) =>
          q.eq("threadId", args.threadId).eq("status", args.status!),
        )
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("developerActions")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .collect();
  },
});

export const updateDeveloperActionPayload = mutation({
  args: {
    actionId: v.id("developerActions"),
    payload: v.any(),
  },
  handler: async (ctx, { actionId, payload }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(actionId);
    if (!row) throw new Error("Action not found");
    if (row.userId !== userId) throw new Error("Access denied");
    if (row.status !== "pending") throw new Error("Only pending actions can be edited");
    await ctx.db.patch(actionId, { editablePayload: payload });
    return { success: true };
  },
});

export const confirmDeveloperAction = mutation({
  args: {
    actionId: v.id("developerActions"),
    editedPayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(args.actionId);
    if (!row) throw new Error("Action not found");
    if (row.userId !== userId) throw new Error("Access denied");
    if (row.status !== "pending") throw new Error(`Action is already ${row.status}`);

    if (args.editedPayload !== undefined) {
      await ctx.db.patch(args.actionId, {
        editablePayload: args.editedPayload,
      });
    }

    await ctx.db.patch(args.actionId, {
      status: "confirmed",
      confirmedAt: Date.now(),
    });

    const confirmedRow = await ctx.db.get(args.actionId);
    if (!confirmedRow) throw new Error("Action not found after confirm");

    try {
      const result = await executeConfirmedDeveloperAction(ctx, {
        _id: confirmedRow._id,
        userId: confirmedRow.userId,
        actionType: confirmedRow.actionType,
        editablePayload: confirmedRow.editablePayload,
      });
      await ctx.db.patch(args.actionId, {
        status: "executed",
        executedAt: Date.now(),
        executionResult: result,
      });
      return { success: true, result };
    } catch (error) {
      await ctx.db.patch(args.actionId, {
        status: "failed",
        failedAt: Date.now(),
        executionResult: {
          success: false,
          error: error instanceof Error ? error.message : "Execution failed",
        },
      });
      throw error;
    }
  },
});

export const cancelDeveloperAction = mutation({
  args: {
    actionId: v.id("developerActions"),
  },
  handler: async (ctx, { actionId }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(actionId);
    if (!row) throw new Error("Action not found");
    if (row.userId !== userId) throw new Error("Access denied");
    if (row.status !== "pending") throw new Error("Only pending actions can be cancelled");
    await ctx.db.patch(actionId, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });
    return { success: true };
  },
});
