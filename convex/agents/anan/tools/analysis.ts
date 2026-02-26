/**
 * Analysis tools – quality judgement + article composition.
 */
import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { toonEncode } from "../../../lib/toon";

export function createAnalysisTools() {
  const judgeSearchCoverage = createTool({
    description:
      "Judge search quality for current results. Use after property/web search to evaluate coverage, freshness confidence, image richness, and suggest next actions.",
    args: z.object({
      query: z.string(),
      resultCount: z.number().optional().default(0),
      imageCount: z.number().optional().default(0),
      sourceCount: z.number().optional().default(0),
      hasFreshSignals: z.boolean().optional().default(false),
    }),
    handler: async (_ctx, { query, resultCount, imageCount, sourceCount, hasFreshSignals }) => {
      const coverageScore = Math.min(100, resultCount * 12 + sourceCount * 8);
      const galleryScore = Math.min(100, imageCount * 8);
      const freshnessScore = hasFreshSignals ? 85 : 55;
      const overallScore = Math.round(
        coverageScore * 0.45 + galleryScore * 0.25 + freshnessScore * 0.3,
      );
      const verdict =
        overallScore >= 80
          ? "strong"
          : overallScore >= 60
            ? "moderate"
            : "weak";
      const nextActions: string[] = [];
      if (resultCount < 5) {
        nextActions.push("Expand search scope with additional domains and alternate keywords.");
      }
      if (imageCount < 8) {
        nextActions.push("Run extra image queries and enrich top detail pages for gallery.");
      }
      if (!hasFreshSignals) {
        nextActions.push("Run deep web search with freshness-focused query variants.");
      }
      return toonEncode({
        query,
        scores: {
          overall: overallScore,
          coverage: coverageScore,
          gallery: galleryScore,
          freshness: freshnessScore,
        },
        verdict,
        nextActions,
      });
    },
  });

  const formatAsArticle = createTool({
    description:
      "Format content as a concise article-style response for web and WhatsApp. Keeps sections clear and avoids raw links unless explicitly requested.",
    args: z.object({
      title: z.string(),
      summary: z.string(),
      keyPoints: z.array(z.string()).optional().default([]),
      recommendations: z.array(z.string()).optional().default([]),
      language: z.enum(["ar", "en"]).optional().default("ar"),
    }),
    handler: async (_ctx, { title, summary, keyPoints, recommendations, language }) => {
      const keyHeader = language === "ar" ? "## النقاط الرئيسية" : "## Key Points";
      const recHeader = language === "ar" ? "## التوصيات" : "## Recommendations";
      const bullets = (items: string[]) =>
        items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "-";
      const article = [
        `# ${title}`,
        "",
        summary,
        "",
        keyHeader,
        bullets(keyPoints),
        "",
        recHeader,
        bullets(recommendations),
      ].join("\n");
      return toonEncode({ article });
    },
  });

  return {
    judgeSearchCoverage,
    formatAsArticle,
  };
}
