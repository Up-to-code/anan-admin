import { internalQuery } from "../../_generated/server";
import { v } from "convex/values";

/** Internal: find partner by API key hash. Used by HTTP action. */
export const getPartnerByApiKeyHash = internalQuery({
  args: { apiKeyHash: v.string() },
  handler: async (ctx, { apiKeyHash }) => {
    const partners = await ctx.db.query("partners").collect();
    const partner = partners.find(
      (p) =>
        p.apiKeyHash === apiKeyHash && (p.status === "active" || !p.status)
    );
    return partner?._id ?? null;
  },
});
