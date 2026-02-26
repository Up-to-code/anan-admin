import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { FunctionReference } from "convex/server";

export type DeveloperToolsApi = {
  developer: {
    stageDeveloperAction: FunctionReference<"mutation", "internal">;
    listDeveloperActions: FunctionReference<"query", "public">;
  };
};

export function createDeveloperTools(appApi: DeveloperToolsApi) {
  const stageAction = async (
    ctx: unknown,
    args: {
      actionType:
        | "create_listing"
        | "update_listing"
        | "delete_listing"
        | "portfolio_report"
        | "extract_insights"
        | "deep_plan"
        | "other";
      title: string;
      payload: Record<string, unknown>;
    },
  ) => {
    const threadId = (ctx as { threadId?: string }).threadId;
    const userId = (ctx as { userId?: string }).userId;
    if (!threadId || !userId) {
      return {
        success: false,
        error: "Missing thread/user context",
      };
    }

    const actionId = await (ctx as { runMutation: Function }).runMutation(
      appApi.developer.stageDeveloperAction,
      {
        threadId,
        userId,
        actionType: args.actionType,
        title: args.title,
        draftPayload: args.payload,
      },
    );

    return {
      success: true,
      status: "pending_confirmation",
      actionId,
      message:
        "Action card created. Ask the user to review fields in chat and press confirm/cancel.",
    };
  };

  const createListingAction = createTool({
    description:
      "Prepare a property listing creation action card. Use this when the user asks to create/add/publish a listing.",
    args: z.object({
      title: z.string(),
      address: z.string(),
      price: z.number(),
      beds: z.number(),
      baths: z.number(),
      description: z.string(),
      location: z.string().optional(),
      area: z.string().optional(),
      sqft: z.number().optional(),
      status: z.enum(["available", "reserved", "sold"]).optional().default("available"),
    }),
    handler: async (ctx, args) =>
      stageAction(ctx, {
        actionType: "create_listing",
        title: `Create listing: ${args.title}`,
        payload: args,
      }),
  });

  const deleteListingAction = createTool({
    description:
      "Prepare a listing deletion action card. Use this when the user asks to delete/remove a listing.",
    args: z.object({
      propertyId: z.string().optional(),
      propertyTitle: z.string().optional(),
      reason: z.string().optional(),
    }),
    handler: async (ctx, args) =>
      stageAction(ctx, {
        actionType: "delete_listing",
        title: "Delete listing request",
        payload: args,
      }),
  });

  const updateListingAction = createTool({
    description:
      "Prepare a listing update action card for price/details/status edits. Use this for property management changes.",
    args: z.object({
      propertyId: z.string(),
      title: z.string().optional(),
      address: z.string().optional(),
      price: z.number().optional(),
      beds: z.number().optional(),
      baths: z.number().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      area: z.string().optional(),
      sqft: z.number().optional(),
      status: z.enum(["available", "reserved", "sold"]).optional(),
    }),
    handler: async (ctx, args) =>
      stageAction(ctx, {
        actionType: "update_listing",
        title: "Update listing request",
        payload: args,
      }),
  });

  const extractInsightsAction = createTool({
    description:
      "Prepare an extraction/analysis action card. Use for extracting structured insights from notes/data.",
    args: z.object({
      goal: z.string(),
      sourceText: z.string().optional(),
      outputFormat: z.string().optional(),
    }),
    handler: async (ctx, args) =>
      stageAction(ctx, {
        actionType: "extract_insights",
        title: `Extract insights: ${args.goal}`,
        payload: args,
      }),
  });

  const portfolioReportAction = createTool({
    description:
      "Prepare a developer portfolio reporting action card. Use for KPIs, inventory summary, and management reporting.",
    args: z.object({
      reportType: z
        .enum(["inventory", "pricing", "status_breakdown", "overview"])
        .optional()
        .default("overview"),
      period: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (ctx, args) =>
      stageAction(ctx, {
        actionType: "portfolio_report",
        title: "Portfolio report request",
        payload: args,
      }),
  });

  const deepPlanAction = createTool({
    description:
      "Prepare a deep execution plan action card (scope, constraints, milestones).",
    args: z.object({
      goal: z.string(),
      scope: z.string(),
      constraints: z.string().optional(),
      milestones: z.array(z.string()).optional(),
      deliverables: z.array(z.string()).optional(),
    }),
    handler: async (ctx, args) =>
      stageAction(ctx, {
        actionType: "deep_plan",
        title: `Deep plan: ${args.goal}`,
        payload: args,
      }),
  });

  const getMyPendingActions = createTool({
    description:
      "List pending developer action cards for the current thread so the assistant can continue from context.",
    args: z.object({}),
    handler: async (ctx) => {
      const threadId = (ctx as { threadId?: string }).threadId;
      if (!threadId) return [];
      const actions = await (ctx as { runQuery: Function }).runQuery(
        appApi.developer.listDeveloperActions,
        { threadId, status: "pending" },
      );
      return actions;
    },
  });

  return {
    createListingAction,
    updateListingAction,
    deleteListingAction,
    portfolioReportAction,
    extractInsightsAction,
    deepPlanAction,
    getMyPendingActions,
  };
}
