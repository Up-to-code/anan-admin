/**
 * Internal action for Serper web search. Used with Action Cache for webSearch and searchRealEstateInfo.
 */
import { internalAction } from "../../../_generated/server";
import { v } from "convex/values";
import { sanitizeWebText } from "../../_lib/sanitize";
import { detectPreferredLanguage } from "../../../lib/language";

export const runSerperWebSearch = internalAction({
  args: {
    query: v.string(),
    num: v.optional(v.number()),
  },
  handler: async (_ctx, { query, num = 5 }): Promise<
    | { ok: true; results: { title: string; url: string; snippet: string }[] }
    | { ok: false; error: string }
  > => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Web search is not configured (missing SERPER_API_KEY)." };
    }
    try {
      const preferredLanguage = detectPreferredLanguage(query);
      const localeParams =
        preferredLanguage === "ar" ? { gl: "sa", hl: "ar" } : { gl: "us", hl: "en" };
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          q: query,
          num: Math.min(num, 10),
          ...localeParams,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `Web search failed: ${res.status} ${text}` };
      }
      const data = (await res.json()) as {
        organic?: Array<{ title?: string; link?: string; snippet?: string }>;
      };
      const results = (data.organic ?? []).slice(0, num).map((o) => ({
        title: sanitizeWebText(o.title),
        url: o.link ?? "",
        snippet: sanitizeWebText(o.snippet),
      }));
      return { ok: true, results };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Web search request failed",
      };
    }
  },
});
