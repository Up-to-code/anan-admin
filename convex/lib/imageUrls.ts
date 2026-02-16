/**
 * Image URL utilities for consistent handling across the codebase.
 */
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Add image URLs to an array of items that have an imageId field.
 * Removes the imageId field and adds imageUrl in its place.
 * 
 * @param ctx - The query context with storage access
 * @param items - Array of items with optional imageId field
 * @returns Array of items with imageUrl instead of imageId
 */
export async function addImageUrls<T extends { imageId?: Id<"_storage"> }>(
  ctx: QueryCtx,
  items: T[]
): Promise<(Omit<T, "imageId"> & { imageUrl?: string })[]> {
  return Promise.all(
    items.map(async (item) => {
      const imageUrl = item.imageId
        ? (await ctx.storage.getUrl(item.imageId)) ?? undefined
        : undefined;
      const { imageId: _id, ...rest } = item;
      return { ...rest, imageUrl } as Omit<T, "imageId"> & { imageUrl?: string };
    })
  );
}

/**
 * Add a single image URL to an item.
 * 
 * @param ctx - The query context with storage access
 * @param item - Item with optional imageId field
 * @returns Item with imageUrl instead of imageId
 */
export async function addImageUrl<T extends { imageId?: Id<"_storage"> }>(
  ctx: QueryCtx,
  item: T
): Promise<Omit<T, "imageId"> & { imageUrl?: string }> {
  const [result] = await addImageUrls(ctx, [item]);
  return result;
}

/**
 * Get the URL for a storage ID, returning undefined if not found.
 * 
 * @param ctx - The query context with storage access
 * @param storageId - The storage ID to get the URL for
 * @returns The URL or undefined
 */
export async function getStorageUrl(
  ctx: QueryCtx,
  storageId: Id<"_storage"> | undefined | null
): Promise<string | undefined> {
  if (!storageId) return undefined;
  return (await ctx.storage.getUrl(storageId)) ?? undefined;
}

/**
 * Add logo URLs to an array of items that have a logoId field.
 * Similar to addImageUrls but for logo fields.
 * 
 * @param ctx - The query context with storage access
 * @param items - Array of items with optional logoId field
 * @returns Array of items with logoUrl instead of logoId
 */
export async function addLogoUrls<T extends { logoId?: Id<"_storage"> }>(
  ctx: QueryCtx,
  items: T[]
): Promise<(Omit<T, "logoId"> & { logoUrl?: string })[]> {
  return Promise.all(
    items.map(async (item) => {
      const logoUrl = item.logoId
        ? (await ctx.storage.getUrl(item.logoId)) ?? undefined
        : undefined;
      const { logoId: _id, ...rest } = item;
      return { ...rest, logoUrl } as Omit<T, "logoId"> & { logoUrl?: string };
    })
  );
}

/**
 * Add avatar URLs to an array of items that have an avatarStorageId field.
 * 
 * @param ctx - The query context with storage access
 * @param items - Array of items with optional avatarStorageId field
 * @returns Array of items with avatarUrl instead of avatarStorageId
 */
export async function addAvatarUrls<T extends { avatarStorageId?: Id<"_storage"> }>(
  ctx: QueryCtx,
  items: T[]
): Promise<(Omit<T, "avatarStorageId"> & { avatarUrl?: string })[]> {
  return Promise.all(
    items.map(async (item) => {
      const avatarUrl = item.avatarStorageId
        ? (await ctx.storage.getUrl(item.avatarStorageId)) ?? undefined
        : undefined;
      const { avatarStorageId: _id, ...rest } = item;
      return { ...rest, avatarUrl } as Omit<T, "avatarStorageId"> & { avatarUrl?: string };
    })
  );
}
