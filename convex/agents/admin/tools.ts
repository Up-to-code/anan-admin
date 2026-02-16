/**
 * Admin agent tools – create/manage properties, banks, partners.
 * Migrated from application/agent/tools/admin.
 */
import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../lib/toon";
import { z } from "zod";
import type { FunctionReference } from "convex/server";

export type AdminToolsApi = {
  admin: {
    stagePendingCreateAction: FunctionReference<"mutation", "public" | "internal">;
    propertiesList: FunctionReference<"query", "public">;
    banksList: FunctionReference<"query", "public">;
    partnersList: FunctionReference<"query", "public">;
  };
};

export function createAdminTools(appApi: AdminToolsApi) {
  const stageCreateAction = async (
    ctx: unknown,
    {
      actionType,
      entityType,
      payload,
      needsMedia,
    }: {
      actionType: string;
      entityType: "property" | "bank" | "partner" | "bankProduct" | "other";
      payload: Record<string, unknown>;
      needsMedia: boolean;
    }
  ) => {
    const threadId = (ctx as { threadId?: string }).threadId;
    const createdBy = (ctx as { userId?: string }).userId ?? "admin-unknown";
    if (!threadId) {
      return toonEncode({
        success: false,
        error: "Unable to stage action without thread context.",
      });
    }

    const pendingActionId = await (ctx as { runMutation: Function }).runMutation(
      appApi.admin.stagePendingCreateAction,
      {
        threadId,
        createdBy,
        actionType,
        entityType,
        draftPayload: payload,
        needsMedia,
      }
    );

    return toonEncode({
      success: true,
      status: "pending_confirmation",
      pendingActionId,
      requiresMediaQuestion: needsMedia,
      message: needsMedia
        ? "Draft created. Ask the admin if they want to upload images/logo now, then confirm or cancel from the approval card."
        : "Draft created. Ask the admin to review and click confirm or cancel from the approval card.",
    });
  };

  const createProperty = createTool({
    description: `Create a new real estate property listing. Required fields: title, address, price, beds, baths, description.

IMPORTANT: Before calling this tool, you MUST ask the user for ALL required fields one by one:
1. First ask for the property title (e.g., "Villa in Dubai Marina")
2. Then ask for the address
3. Then ask for the price (in numbers)
4. Then ask for number of bedrooms
5. Then ask for number of bathrooms
6. Finally ask for a description

Only call this tool when you have collected ALL required information from the user.

Before final confirmation, ask: "Do you want to upload property images now?"`,
    args: z.object({
      title: z.string().describe("Property title"),
      address: z.string().describe("Property address"),
      price: z.number().describe("Property price in local currency"),
      beds: z.number().describe("Number of bedrooms"),
      baths: z.number().describe("Number of bathrooms"),
      description: z.string().describe("Property description"),
      sqft: z.number().optional().describe("Square footage"),
      location: z.string().optional().describe("Location/city"),
      area: z.string().optional().describe("Area/neighborhood"),
      status: z.enum(["available", "sold", "reserved"]).optional().default("available"),
    }),
    handler: async (ctx, args) => {
      try {
        return await stageCreateAction(ctx, {
          actionType: "createProperty",
          entityType: "property",
          needsMedia: true,
          payload: {
            title: args.title,
            address: args.address,
            price: args.price,
            beds: args.beds,
            baths: args.baths,
            description: args.description,
            sqft: args.sqft,
            location: args.location,
            area: args.area,
            status: args.status,
          },
        });
      } catch (error) {
        return toonEncode({
          success: false,
          error: error instanceof Error ? error.message : "Failed to create property",
        });
      }
    },
  });

  const createBank = createTool({
    description: `Create a new bank in the system. Required fields: name, slug, contactEmail. Ask for each field one by one.

Before final confirmation, ask: "Do you want to upload a bank logo/images now?"`,
    args: z.object({
      name: z.string().describe("Bank name"),
      slug: z.string().describe("URL-friendly slug (lowercase, hyphens)"),
      contactEmail: z.string().email().describe("Contact email address"),
      status: z.enum(["active", "inactive", "suspended"]).optional().default("active"),
      description: z.string().optional().describe("Bank description"),
    }),
    handler: async (ctx, args) => {
      try {
        const slug = args.slug.trim().toLowerCase().replace(/\s+/g, "-");
        return await stageCreateAction(ctx, {
          actionType: "createBank",
          entityType: "bank",
          needsMedia: true,
          payload: {
            name: args.name,
            slug,
            contactEmail: args.contactEmail,
            status: args.status,
            description: args.description,
          },
        });
      } catch (error) {
        return toonEncode({
          success: false,
          error: error instanceof Error ? error.message : "Failed to create bank",
        });
      }
    },
  });

  const createDeveloper = createTool({
    description: `Create a new developer/partner. Required: name, slug. Ask for each field one by one.

Before final confirmation, ask: "Do you want to upload a developer logo/images now?"`,
    args: z.object({
      name: z.string().describe("Developer/partner name"),
      slug: z.string().describe("URL-friendly slug (lowercase, hyphens)"),
      contactEmail: z.string().email().optional().describe("Contact email"),
      phone: z.string().optional().describe("Phone number"),
      website: z.string().url().optional().describe("Website URL"),
      description: z.string().optional().describe("Description"),
      status: z.enum(["active", "pending"]).optional().default("pending"),
    }),
    handler: async (ctx, args) => {
      try {
        const slug = args.slug.trim().toLowerCase().replace(/\s+/g, "-");
        return await stageCreateAction(ctx, {
          actionType: "createDeveloper",
          entityType: "partner",
          needsMedia: true,
          payload: {
            name: args.name,
            slug,
            contactEmail: args.contactEmail,
            phone: args.phone,
            website: args.website,
            description: args.description,
            status: args.status,
          },
        });
      } catch (error) {
        return toonEncode({
          success: false,
          error: error instanceof Error ? error.message : "Failed to create developer",
        });
      }
    },
  });

  const listProperties = createTool({
    description: "List all properties in the system.",
    args: z.object({
      limit: z.number().optional().default(20).describe("Maximum number of properties to return"),
    }),
    handler: async (ctx, { limit }) => {
      try {
        const properties = await ctx.runQuery(appApi.admin.propertiesList, { limit });
        return toonEncode({
          success: true,
          count: Array.isArray(properties) ? properties.length : 0,
          properties,
        });
      } catch (error) {
        return toonEncode({
          success: false,
          error: error instanceof Error ? error.message : "Failed to list properties",
        });
      }
    },
  });

  const listBanks = createTool({
    description: "List all banks in the system.",
    args: z.object({
      limit: z.number().optional().default(20).describe("Maximum number of banks to return"),
    }),
    handler: async (ctx, { limit }) => {
      try {
        const banks = await ctx.runQuery(appApi.admin.banksList, { limit });
        return toonEncode({
          success: true,
          count: Array.isArray(banks) ? banks.length : 0,
          banks,
        });
      } catch (error) {
        return toonEncode({
          success: false,
          error: error instanceof Error ? error.message : "Failed to list banks",
        });
      }
    },
  });

  const listDevelopers = createTool({
    description: "List all developers/partners in the system.",
    args: z.object({
      limit: z.number().optional().default(20).describe("Maximum number of developers to return"),
    }),
    handler: async (ctx, { limit }) => {
      try {
        const partners = await ctx.runQuery(appApi.admin.partnersList, {});
        return toonEncode({
          success: true,
          count: Array.isArray(partners) ? partners.length : 0,
          developers: partners,
        });
      } catch (error) {
        return toonEncode({
          success: false,
          error: error instanceof Error ? error.message : "Failed to list developers",
        });
      }
    },
  });

  return {
    createProperty,
    createBank,
    createDeveloper,
    listProperties,
    listBanks,
    listDevelopers,
  };
}
