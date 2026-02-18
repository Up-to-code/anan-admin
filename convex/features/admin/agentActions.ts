/**
 * Admin Agent Actions - handles chat functionality for the admin panel.
 */
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { createAdminAgent } from "./agent";
import { authComponent } from "../../auth";
import { requireAdmin } from "../../lib/auth";
import type { Id } from "../../_generated/dataModel";
import { getChatModel } from "../../lib/providers";
import { generateText } from "ai";

// Create the admin agent with the API
const adminAgent = createAdminAgent({
  admin: {
    stagePendingCreateAction: internal.features.admin.agentActions.stagePendingCreateAction,
    propertiesList: api.features.admin.api.propertiesList,
    banksList: api.features.admin.api.banksList,
    partnersList: api.features.admin.api.partnersList,
  },
});

const pendingActionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("executed"),
  v.literal("failed")
);

const pendingActionEntityTypeValidator = v.union(
  v.literal("property"),
  v.literal("bank"),
  v.literal("partner"),
  v.literal("bankProduct"),
  v.literal("other")
);

const mediaEntityTypeValidator = v.union(
  v.literal("property"),
  v.literal("bank"),
  v.literal("partner")
);

const adminTaskScopeValidator = v.union(
  v.literal("users"),
  v.literal("orders"),
  v.literal("properties"),
  v.literal("banks"),
  v.literal("knowledge"),
  v.literal("prompts"),
  v.literal("analytics"),
  v.literal("system")
);

const adminTaskModeValidator = v.union(
  v.literal("plan_then_execute"),
  v.literal("plan_only"),
  v.literal("execute_only"),
  v.literal("audit")
);

const adminTaskOutputStyleValidator = v.union(
  v.literal("brief"),
  v.literal("detailed"),
  v.literal("checklist")
);

function buildAdminTaskPrompt(args: {
  goal: string;
  scope: "users" | "orders" | "properties" | "banks" | "knowledge" | "prompts" | "analytics" | "system";
  mode: "plan_then_execute" | "plan_only" | "execute_only" | "audit";
  outputStyle: "brief" | "detailed" | "checklist";
  context?: string;
  acceptanceCriteria?: string[];
  requirements: {
    needUi: boolean;
    needBackend: boolean;
    needTests: boolean;
    needRisks: boolean;
    needRollback: boolean;
    needMetrics: boolean;
  };
}): string {
  const scopeLabel = (() => {
    if (args.scope === "users") return "المستخدمون";
    if (args.scope === "orders") return "الطلبات";
    if (args.scope === "properties") return "العقارات";
    if (args.scope === "banks") return "البنوك";
    if (args.scope === "knowledge") return "المعرفة";
    if (args.scope === "prompts") return "البرومبتات";
    if (args.scope === "analytics") return "التحليلات";
    return "النظام";
  })();

  const modeLabel = (() => {
    if (args.mode === "plan_only") return "خطة فقط";
    if (args.mode === "execute_only") return "تنفيذ مباشر";
    if (args.mode === "audit") return "تدقيق ومراجعة";
    return "خطة ثم تنفيذ";
  })();

  const styleLabel = (() => {
    if (args.outputStyle === "brief") return "مختصر";
    if (args.outputStyle === "checklist") return "قائمة تنفيذ";
    return "تفصيلي";
  })();

  const requiredLines: string[] = [];
  if (args.requirements.needUi) requiredLines.push("- تحديث واجهات الأدمن إذا كانت متأثرة.");
  if (args.requirements.needBackend) requiredLines.push("- تحديث الباكند وواجهات API إذا لزم.");
  if (args.requirements.needTests) {
    requiredLines.push("- إضافة/تحديث اختبارات أو على الأقل smoke checks.");
  }
  if (args.requirements.needRisks) {
    requiredLines.push("- ذكر المخاطر والانحدارات المحتملة.");
  }
  if (args.requirements.needRollback) {
    requiredLines.push("- تضمين خطة rollback واضحة.");
  }
  if (args.requirements.needMetrics) {
    requiredLines.push("- ذكر كيف نقيس النجاح بعد التنفيذ.");
  }
  if (requiredLines.length === 0) {
    requiredLines.push("- التزم بأفضل ممارسات التنفيذ والتحقق.");
  }

  const criteriaLines =
    args.acceptanceCriteria && args.acceptanceCriteria.length > 0
      ? `\nمعايير القبول:\n${args.acceptanceCriteria.map((line) => `- ${line}`).join("\n")}`
      : "";
  const contextBlock = args.context ? `\nالسياق:\n${args.context}` : "";
  const outputInstruction =
    args.outputStyle === "checklist"
      ? "الإخراج المطلوب بصيغة قائمة تنفيذية واضحة."
      : args.outputStyle === "brief"
        ? "الإخراج المطلوب مختصر وواضح."
        : "الإخراج المطلوب تفصيلي مع خطوات عملية.";

  return `أنت مساعد إداري تقني في مشروع ANAN.

المهمة الرئيسية:
${args.goal}

النطاق:
- القسم: ${scopeLabel}
- نمط العمل: ${modeLabel}
- أسلوب الإخراج: ${styleLabel}

المتطلبات الإلزامية:
${requiredLines.join("\n")}
${contextBlock}
${criteriaLines}

تعليمات التنفيذ:
1) افهم الوضع الحالي بسرعة.
2) قدم خطة عمل مرتبة (P0 ثم P1).
3) ${
    args.mode === "plan_only"
      ? "توقف عند الخطة ولا تنفذ تغييرات."
      : "نفذ التعديلات المطلوبة بالكامل."
  }
4) اعرض ما تم تغييره وكيف نتحقق منه.
5) ${outputInstruction}`;
}

async function resolveAdminThread(
  ctx: MutationCtx,
  args: { threadId?: string; title?: string; adminUserId: string }
): Promise<string> {
  const scopedUserId = `admin-${args.adminUserId}`;
  if (args.threadId) {
    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread || thread.userId !== scopedUserId) {
      throw new Error("Thread not found or access denied");
    }
    return args.threadId;
  }

  return await createThread(ctx, components.agent, {
    userId: scopedUserId,
    title: args.title?.trim() || "Admin Task",
  });
}

async function getAdminUserId(ctx: Parameters<typeof requireAdmin>[0]): Promise<string> {
  const userId = await requireAdmin(ctx);
  return userId;
}

async function executePendingCreateAction(
  ctx: MutationCtx,
  pendingAction: {
    _id: Id<"adminPendingActions">;
    actionType: string;
    entityType: "property" | "bank" | "partner" | "bankProduct" | "other";
    editablePayload: any;
  }
): Promise<{ entityId: string; entityType: string }> {
  const payload = (pendingAction.editablePayload ?? {}) as Record<string, unknown>;

  if (pendingAction.actionType === "createProperty") {
    const entityId = await ctx.runMutation(api.features.admin.api.propertyCreate, {
      title: String(payload.title ?? ""),
      address: String(payload.address ?? ""),
      price: Number(payload.price ?? 0),
      beds: Number(payload.beds ?? 0),
      baths: Number(payload.baths ?? 0),
      description: String(payload.description ?? ""),
      sqft: payload.sqft == null ? undefined : Number(payload.sqft),
      location: payload.location == null ? undefined : String(payload.location),
      area: payload.area == null ? undefined : String(payload.area),
      status:
        payload.status === "sold" || payload.status === "reserved"
          ? payload.status
          : "available",
    });
    return { entityId, entityType: "property" };
  }

  if (pendingAction.actionType === "createBank") {
    const slug = String(payload.slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const entityId = await ctx.runMutation(api.features.admin.api.bankCreate, {
      name: String(payload.name ?? ""),
      slug,
      contactEmail: String(payload.contactEmail ?? ""),
      status:
        payload.status === "inactive" || payload.status === "suspended"
          ? payload.status
          : "active",
      description: payload.description == null ? undefined : String(payload.description),
    });
    return { entityId, entityType: "bank" };
  }

  if (pendingAction.actionType === "createDeveloper") {
    const slug = String(payload.slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const entityId = await ctx.runMutation(api.features.admin.api.partnerCreate, {
      name: String(payload.name ?? ""),
      slug,
      contactEmail: payload.contactEmail == null ? undefined : String(payload.contactEmail),
      phone: payload.phone == null ? undefined : String(payload.phone),
      website: payload.website == null ? undefined : String(payload.website),
      description: payload.description == null ? undefined : String(payload.description),
      status: payload.status === "active" ? "active" : "pending",
    });
    return { entityId, entityType: "partner" };
  }

  if (pendingAction.actionType === "createBankProduct") {
    const entityId = await ctx.runMutation(api.features.admin.api.bankProductCreate, {
      bankId: String(payload.bankId) as Id<"banks">,
      name: String(payload.name ?? ""),
      type: String(payload.type ?? ""),
      description: payload.description == null ? undefined : String(payload.description),
      rules: payload.rules,
    });
    return { entityId, entityType: "bankProduct" };
  }

  throw new Error(`Unsupported pending action type: ${pendingAction.actionType}`);
}

async function attachPendingMediaToEntity(
  ctx: MutationCtx,
  pendingActionId: Id<"adminPendingActions">,
  entityType: "property" | "bank" | "partner" | "bankProduct" | "other",
  entityId: string
): Promise<void> {
  if (entityType !== "property" && entityType !== "bank" && entityType !== "partner") {
    return;
  }

  const mediaRows = await ctx.db
    .query("entityMedia")
    .withIndex("pendingActionId_and_sortOrder", (q) => q.eq("pendingActionId", pendingActionId))
    .collect();
  const sortedRows = mediaRows.sort((a, b) => a.sortOrder - b.sortOrder);

  for (let i = 0; i < sortedRows.length; i += 1) {
    const row = sortedRows[i];
    await ctx.db.patch(row._id, {
      pendingActionId: undefined,
      entityId,
      sortOrder: i,
      isPrimary: i === 0,
    });
  }

  const primary = sortedRows[0];
  if (!primary) return;

  if (entityType === "property") {
    await ctx.db.patch(entityId as Id<"properties">, { imageId: primary.storageId });
  } else if (entityType === "bank") {
    await ctx.db.patch(entityId as Id<"banks">, { logoId: primary.storageId });
  } else if (entityType === "partner") {
    await ctx.db.patch(entityId as Id<"partners">, { logoId: primary.storageId });
  }
}

/**
 * Create a new admin thread.
 * Requires admin authentication.
 */
export const createAdminThread = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, { title }) => {
    const userId = await getAdminUserId(ctx);
    
    const threadId = await createThread(ctx, components.agent, {
      userId: `admin-${userId}`,
      title: title ?? "Admin Chat",
    });
    
    return { threadId };
  },
});

/**
 * Send a message to the admin agent and trigger async response.
 */
export const sendAdminMessage = mutation({
  args: {
    threadId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { threadId, body }) => {
    await getAdminUserId(ctx);
    
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: body,
    });
    
    await ctx.scheduler.runAfter(0, internal.features.admin.agentActions.generateAdminResponse, {
      threadId,
      promptMessageId: messageId,
    });
  },
});

/**
 * Send a structured admin task request to the agent.
 * Creates a thread when missing, builds the final prompt server-side, and schedules response.
 */
export const sendAdminTaskRequest = mutation({
  args: {
    threadId: v.optional(v.string()),
    goal: v.string(),
    scope: adminTaskScopeValidator,
    mode: adminTaskModeValidator,
    outputStyle: adminTaskOutputStyleValidator,
    context: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
    requirements: v.object({
      needUi: v.boolean(),
      needBackend: v.boolean(),
      needTests: v.boolean(),
      needRisks: v.boolean(),
      needRollback: v.boolean(),
      needMetrics: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const adminUserId = await getAdminUserId(ctx);
    const goal = args.goal.trim();
    if (!goal) {
      throw new Error("Task goal is required");
    }

    const acceptanceCriteria = (args.acceptanceCriteria ?? [])
      .map((line) => line.trim())
      .filter(Boolean);

    const builtPrompt = buildAdminTaskPrompt({
      goal,
      scope: args.scope,
      mode: args.mode,
      outputStyle: args.outputStyle,
      context: args.context?.trim() || undefined,
      acceptanceCriteria,
      requirements: args.requirements,
    });

    const threadId = await resolveAdminThread(ctx, {
      adminUserId,
      threadId: args.threadId,
      title: goal.slice(0, 60),
    });

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: builtPrompt,
    });

    await ctx.scheduler.runAfter(0, internal.features.admin.agentActions.generateAdminResponse, {
      threadId,
      promptMessageId: messageId,
    });

    return { threadId, messageId };
  },
});

/**
 * Internal: stage create action instead of executing immediately.
 * Called by admin create tools.
 */
export const stagePendingCreateAction = internalMutation({
  args: {
    threadId: v.string(),
    createdBy: v.string(),
    actionType: v.string(),
    entityType: pendingActionEntityTypeValidator,
    draftPayload: v.any(),
    needsMedia: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("adminPendingActions", {
      threadId: args.threadId,
      createdBy: args.createdBy,
      actionType: args.actionType,
      entityType: args.entityType,
      status: "pending",
      draftPayload: args.draftPayload,
      editablePayload: args.draftPayload,
      needsMedia: args.needsMedia,
    });
  },
});

export const listPendingActions = query({
  args: {
    threadId: v.string(),
    status: v.optional(pendingActionStatusValidator),
  },
  handler: async (ctx, args) => {
    await getAdminUserId(ctx);

    if (args.status) {
      return await ctx.db
        .query("adminPendingActions")
        .withIndex("threadId_and_status", (q) =>
          q.eq("threadId", args.threadId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("adminPendingActions")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .collect();
  },
});

export const updatePendingActionPayload = mutation({
  args: {
    actionId: v.id("adminPendingActions"),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await getAdminUserId(ctx);
    const actionRow = await ctx.db.get(args.actionId);
    if (!actionRow) throw new Error("Pending action not found");
    if (actionRow.status !== "pending") {
      throw new Error("Only pending actions can be edited");
    }
    await ctx.db.patch(args.actionId, { editablePayload: args.payload });
    return { success: true };
  },
});

export const cancelPendingAction = mutation({
  args: { actionId: v.id("adminPendingActions") },
  handler: async (ctx, { actionId }) => {
    const adminUserId = await getAdminUserId(ctx);
    const actionRow = await ctx.db.get(actionId);
    if (!actionRow) throw new Error("Pending action not found");
    if (actionRow.status !== "pending") {
      throw new Error("Only pending actions can be cancelled");
    }

    await ctx.db.patch(actionId, {
      status: "cancelled",
      cancelledBy: adminUserId,
      cancelledAt: Date.now(),
    });
    return { success: true };
  },
});

export const confirmPendingAction = mutation({
  args: {
    actionId: v.id("adminPendingActions"),
    editedPayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const adminUserId = await getAdminUserId(ctx);
    const actionRow = await ctx.db.get(args.actionId);
    if (!actionRow) throw new Error("Pending action not found");
    if (actionRow.status !== "pending") {
      throw new Error(`Action is already ${actionRow.status}`);
    }

    if (args.editedPayload !== undefined) {
      await ctx.db.patch(args.actionId, { editablePayload: args.editedPayload });
    }

    await ctx.db.patch(args.actionId, {
      status: "confirmed",
      confirmedBy: adminUserId,
      confirmedAt: Date.now(),
    });

    const rowAfterConfirm = await ctx.db.get(args.actionId);
    if (!rowAfterConfirm) throw new Error("Pending action not found after confirm");

    try {
      const result = await executePendingCreateAction(ctx, {
        _id: rowAfterConfirm._id,
        actionType: rowAfterConfirm.actionType,
        entityType: rowAfterConfirm.entityType,
        editablePayload: rowAfterConfirm.editablePayload,
      });

      await attachPendingMediaToEntity(
        ctx,
        rowAfterConfirm._id,
        rowAfterConfirm.entityType,
        result.entityId
      );

      await ctx.db.patch(args.actionId, {
        status: "executed",
        executedAt: Date.now(),
        executionResult: {
          success: true,
          entityId: result.entityId,
          entityType: result.entityType,
        },
      });
      return { success: true, entityId: result.entityId, entityType: result.entityType };
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

export const generatePendingActionUploadUrl = mutation({
  args: { actionId: v.id("adminPendingActions") },
  handler: async (ctx, { actionId }) => {
    await getAdminUserId(ctx);
    const actionRow = await ctx.db.get(actionId);
    if (!actionRow) throw new Error("Pending action not found");
    if (actionRow.status !== "pending") throw new Error("Action is not pending");
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachPendingActionMedia = mutation({
  args: {
    actionId: v.id("adminPendingActions"),
    storageId: v.id("_storage"),
    kind: v.optional(v.union(v.literal("image"), v.literal("logo"))),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUserId = await getAdminUserId(ctx);
    const actionRow = await ctx.db.get(args.actionId);
    if (!actionRow) throw new Error("Pending action not found");
    if (actionRow.status !== "pending") throw new Error("Action is not pending");
    if (
      actionRow.entityType !== "property" &&
      actionRow.entityType !== "bank" &&
      actionRow.entityType !== "partner"
    ) {
      throw new Error("Media upload is only supported for property, bank, and partner");
    }

    const existing = await ctx.db
      .query("entityMedia")
      .withIndex("pendingActionId", (q) => q.eq("pendingActionId", args.actionId))
      .collect();
    const sortOrder = existing.length;

    const mediaId = await ctx.db.insert("entityMedia", {
      pendingActionId: args.actionId,
      entityType: actionRow.entityType,
      storageId: args.storageId,
      kind:
        args.kind ??
        (actionRow.entityType === "property"
          ? "image"
          : "logo"),
      sortOrder,
      isPrimary: sortOrder === 0,
      caption: args.caption,
      uploadedBy: adminUserId,
    });
    return { mediaId };
  },
});

export const listPendingActionMedia = query({
  args: { actionId: v.id("adminPendingActions") },
  handler: async (ctx, { actionId }) => {
    await getAdminUserId(ctx);
    const rows = await ctx.db
      .query("entityMedia")
      .withIndex("pendingActionId_and_sortOrder", (q) => q.eq("pendingActionId", actionId))
      .collect();

    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: (await ctx.storage.getUrl(row.storageId)) ?? null,
      }))
    );
  },
});

export const removePendingActionMedia = mutation({
  args: { mediaId: v.id("entityMedia") },
  handler: async (ctx, { mediaId }) => {
    await getAdminUserId(ctx);
    const media = await ctx.db.get(mediaId);
    if (!media) throw new Error("Media not found");
    if (!media.pendingActionId) throw new Error("Only pending action media can be removed");

    const actionRow = await ctx.db.get(media.pendingActionId);
    if (!actionRow) throw new Error("Pending action not found");
    if (actionRow.status !== "pending") throw new Error("Action is not pending");

    await ctx.db.delete(mediaId);
    return { success: true };
  },
});

export const reorderPendingActionMedia = mutation({
  args: {
    actionId: v.id("adminPendingActions"),
    mediaIds: v.array(v.id("entityMedia")),
  },
  handler: async (ctx, { actionId, mediaIds }) => {
    await getAdminUserId(ctx);
    const actionRow = await ctx.db.get(actionId);
    if (!actionRow) throw new Error("Pending action not found");
    if (actionRow.status !== "pending") throw new Error("Action is not pending");

    for (let i = 0; i < mediaIds.length; i += 1) {
      const media = await ctx.db.get(mediaIds[i]);
      if (!media || media.pendingActionId !== actionId) continue;
      await ctx.db.patch(media._id, {
        sortOrder: i,
        isPrimary: i === 0,
      });
    }
    return { success: true };
  },
});

export const rewriteAdminCopy = action({
  args: {
    text: v.string(),
    mode: v.union(v.literal("rewrite"), v.literal("formal"), v.literal("summarize")),
  },
  handler: async (_ctx, { text, mode }) => {
    const authUser = await authComponent.getAuthUser(_ctx);
    if (!authUser) {
      throw new Error("Admin authentication required");
    }

    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error("Text is required");
    }

    const modeInstruction =
      mode === "summarize"
        ? "لخّص النص بالعربية الفصحى في فقرة موجزة وواضحة مع الحفاظ على المعنى الأساسي."
        : mode === "formal"
          ? "أعد كتابة النص بالعربية الفصحى بصياغة رسمية ومهنية مناسبة للتواصل الإداري."
          : "أعد صياغة النص بالعربية الفصحى بشكل احترافي وواضح مع تحسين التدفق والوضوح.";

    const { text: rewrittenText } = await generateText({
      model: getChatModel(),
      system:
        "أنت محرر عربي محترف. المطلوب إخراج النص النهائي فقط دون شرح أو نقاط إضافية أو عناوين.",
      prompt: `${modeInstruction}\n\nالنص:\n${cleanText}`,
    });

    return { text: rewrittenText.trim() };
  },
});

/**
 * Internal: generate admin agent response to saved message.
 */
export const generateAdminResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId }) => {
    try {
      await adminAgent.streamText(
        ctx,
        { threadId },
        { promptMessageId } as any,
        { saveStreamDeltas: true }
      );
    } catch (err) {
      console.error("generateAdminResponse error:", err);
      throw err;
    }
  },
});

/**
 * List messages for an admin thread.
 */
export const getAdminThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
  },
  handler: async (ctx, args) => {
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

/**
 * List admin threads for the current admin user.
 */
export const listAdminThreads = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    // Get admin user
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      return { page: [], isDone: true, continueCursor: null };
    }
    
    const userId = `admin-${authUser.userId ?? String(authUser._id)}`;
    
    return ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId,
      paginationOpts,
    });
  },
});

export const searchAdminThreads = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query: searchQuery, limit = 20 }) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return [];

    const userId = `admin-${authUser.userId ?? String(authUser._id)}`;
    return ctx.runQuery(components.agent.threads.searchThreadTitles, {
      userId,
      query: searchQuery,
      limit,
    });
  },
});

export const renameAdminThread = mutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { threadId, title }) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Admin authentication required");
    }

    const userId = `admin-${authUser.userId ?? String(authUser._id)}`;
    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const ownsThread = threads.page.some((t: { _id: string }) => t._id === threadId);
    if (!ownsThread) {
      throw new Error("Thread not found or access denied");
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      throw new Error("Thread title cannot be empty");
    }
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId,
      patch: { title: cleanTitle },
    });
    return { success: true };
  },
});

/**
 * Delete an admin thread.
 * Runs as a mutation so auth context matches createAdminThread/listAdminThreads (admin-${userId}).
 */
export const deleteAdminThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    await requireAdmin(ctx);
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Admin authentication required");
    }

    const userId = `admin-${authUser.userId ?? String(authUser._id)}`;

    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId,
      paginationOpts: { numItems: 100, cursor: null },
    });

    const ownsThread = threads.page.some((t: { _id: string }) => t._id === threadId);
    if (!ownsThread) {
      throw new Error("Thread not found or access denied");
    }

    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId,
    });

    return { success: true };
  },
});
