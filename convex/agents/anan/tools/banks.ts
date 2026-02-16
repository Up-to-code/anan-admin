/**
 * Bank and partner tools.
 */
import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { z } from "zod";
import type { Id } from "../../../_generated/dataModel";
import type { AgentToolsApi } from "./types";

export function createBanksTools(appApi: AgentToolsApi) {
  const getBankInfo = createTool({
    description:
      "Get bank info by slug or id. Use when user asks about a specific bank or mortgage product.",
    args: z.object({
      slug: z.string().optional().describe("Bank slug (e.g. first-national)"),
      id: z.string().optional().describe("Bank document id"),
    }),
    handler: async (ctx, { slug, id }) => {
      if (id) {
        const bank = await ctx.runQuery(appApi.banks.getById, {
          id: id as Id<"banks">,
        });
        return toonEncode(bank ?? { error: "Bank not found" });
      }
      if (slug) {
        const bank = await ctx.runQuery(appApi.banks.getBySlug, { slug });
        return toonEncode(bank ?? { error: "Bank not found" });
      }
      return toonEncode({ error: "Provide slug or id" });
    },
  });

  const getBankBundles = createTool({
    description:
      "List mortgage/loan products across banks with eligibility rules. Use to recommend what user can get.",
    args: z.object({
      bankId: z.string().optional().describe("Filter by bank id"),
    }),
    handler: async (ctx, { bankId }) => {
      const bundles = await ctx.runQuery(appApi.banks.getBundles, {
        bankId: bankId as Id<"banks"> | undefined,
      });
      return toonEncode(bundles);
    },
  });

  const listPartners = createTool({
    description: "List partner organizations. Use when user asks about partners.",
    args: z.object({}),
    handler: async (ctx) => {
      const partners = await ctx.runQuery(appApi.partners.list, {});
      return toonEncode(partners ?? []);
    },
  });

  return { getBankInfo, getBankBundles, listPartners };
}
