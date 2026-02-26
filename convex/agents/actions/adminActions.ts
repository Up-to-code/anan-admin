import { internalMutation, query } from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAdmin } from "../../lib/auth";
import { components } from "../../_generated/api";

export const requireAdminMutation = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

export const listUsersWithThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireAdmin(ctx);
    return ctx.runQuery(components.agent.users.listUsersWithThreads, {
      paginationOpts,
    });
  },
});
