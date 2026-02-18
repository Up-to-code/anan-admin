import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { optionalAuth, getAuthUserId } from "../../lib/auth";
import { ROLE_USER } from "../../roles";

export const get = query({
    args: {},
    handler: async (ctx) => {
        const userId = await optionalAuth(ctx);
        if (!userId) return null;

        // Fetch basic user data (Better Auth 'users' table)
        const user = (await ctx.db.get(userId as any)) as any;

        // Fetch extended profile data
        const userProfile = await ctx.db
            .query("userProfiles")
            .withIndex("userId", (q: any) => q.eq("userId", userId))
            .first();

        if (!user) return null;

        return {
            id: userId,
            name: user.name || userProfile?.name || "",
            email: user.email || "",
            phone: user.phoneNumber || "",
            image: user.image || "",
            // Map extended fields
            location: userProfile?.preferredLocation || "",
            plan: "free", // Defaulting for now
        };
    },
});

export const update = mutation({
    args: {
        name: v.optional(v.string()),
        location: v.optional(v.string()),
        // We don't update phone/email here usually (requires verification)
        imageId: v.optional(v.string()), // ID of uploaded image in storage
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");

        // Update 'users' table (name, image)
        const updates: any = {};
        if (args.name !== undefined) updates.name = args.name;

        if (args.imageId) {
            // Get URL from storage
            const url = await ctx.storage.getUrl(args.imageId);
            if (url) {
                updates.image = url;
            }
        }

        if (Object.keys(updates).length > 0) {
            // Cast db to any to allowing patching 'users' table not in explicit schema keys
            await (ctx.db as any).patch(userId, updates);
        }

        // Update 'userProfiles' table (location)
        const userProfile = await ctx.db
            .query("userProfiles")
            .withIndex("userId", (q: any) => q.eq("userId", userId))
            .first();

        const profileUpdates: any = {};
        if (args.location !== undefined) profileUpdates.preferredLocation = args.location;
        if (args.name !== undefined) profileUpdates.name = args.name; // Keep sync

        if (userProfile) {
            if (Object.keys(profileUpdates).length > 0) {
                await ctx.db.patch(userProfile._id, profileUpdates);
            }
        } else {
            // Create if doesn't exist
            await ctx.db.insert("userProfiles", {
                userId,
                role: ROLE_USER,
                ...profileUpdates,
            });
        }

        return true;
    },
});

export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await getAuthUserId(ctx);
        return await ctx.storage.generateUploadUrl();
    },
});

export const saveImage = mutation({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, { storageId }) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");

        const url = await ctx.storage.getUrl(storageId);
        if (!url) throw new Error("Failed to get URL");

        await (ctx.db as any).patch(userId, { image: url });
        return url;
    }
});
