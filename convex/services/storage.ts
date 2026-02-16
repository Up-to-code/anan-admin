/**
 * Storage service - single source for upload/attach/getImage.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "../lib/auth";
import { notFoundError } from "../lib/errors";

/** Get URL for stored image. Public. */
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});

/** Generate upload URL. Requires auth. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach image to property. Admin only. */
export const attachImageToProperty = mutation({
  args: {
    propertyId: v.id("properties"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, { propertyId, storageId }) => {
    await requireAdmin(ctx);
    const property = await ctx.db.get(propertyId);
    if (!property) throw notFoundError("Property");
    await ctx.db.patch(propertyId, { imageId: storageId });
    return { success: true };
  },
});
