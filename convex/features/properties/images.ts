import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "../../lib/auth";
import { notFoundError } from "../../lib/errors";

/** Get a URL for a stored image (e.g. property image). Public - images are not sensitive. */
export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});

/** Generate a short-lived upload URL for property images.
 * Requires authentication to prevent abuse.
 * Client POSTs file to this URL, then calls attachImageToProperty with the returned storageId.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    // Require authentication to prevent abuse of storage
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach an uploaded image to a property.
 * Requires admin access - only admins can modify properties.
 * Call after uploading file to generateUploadUrl URL.
 */
export const attachImageToProperty = mutation({
  args: {
    propertyId: v.id("properties"),
    storageId: v.id("_storage"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, { propertyId, storageId }) => {
    // Require admin access to modify properties
    await requireAdmin(ctx);
    
    const property = await ctx.db.get(propertyId);
    if (!property) {
      throw notFoundError("Property");
    }
    await ctx.db.patch(propertyId, { imageId: storageId });
    return { success: true };
  },
});
