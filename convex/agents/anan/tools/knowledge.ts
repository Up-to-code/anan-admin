/**
 * Knowledge page tools.
 */
import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { z } from "zod";
import type { AgentToolsApi } from "./types";

export function createKnowledgeTools(appApi: AgentToolsApi) {
  const getKnowledgePage = createTool({
    description:
      "Get a knowledge/FAQ page by slug. Use when user asks how things work (e.g. loans, buying in Saudi). Slugs: loan-guide, saudi-buying, first-time-buyer.",
    args: z.object({
      slug: z.string().describe("Page slug: loan-guide, saudi-buying, first-time-buyer"),
    }),
    handler: async (ctx, { slug }) => {
      const page = await ctx.runQuery(appApi.knowledgePages.getBySlug, {
        slug,
      });
      return toonEncode(page ?? { error: "Page not found" });
    },
  });

  return { getKnowledgePage };
}
