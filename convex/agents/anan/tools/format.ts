/**
 * Formatting tools – formatPropertyOffer wraps offerFormatter for structured output.
 */
import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { z } from "zod";
import { detectPreferredLanguage } from "../../../lib/language";
import { runOfferFormatterAgent } from "../files/offerFormatter";
import type { OfferBlock } from "../../../channels/formatters";

export function createFormatTools() {
  const formatPropertyOffer = createTool({
    description:
      "Format property offer blocks for clean presentation. Use after search results to standardize title, price, location, description. Returns leadText and formatted offerBlocks.",
    args: z.object({
      offerBlocks: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            imageUrls: z.array(z.string()).optional(),
          })
        )
        .describe("Raw offer blocks from search (text, imageUrl, imageUrls)"),
      query: z.string().describe("User query (for language detection and budget hint)"),
      maxImagesPerOffer: z.number().optional().default(3).describe("Max images per offer (1-5)"),
    }),
    handler: async (_ctx, { offerBlocks, query, maxImagesPerOffer }) => {
      const preferredLanguage = detectPreferredLanguage(query);
      const input = {
        offerBlocks: offerBlocks as OfferBlock[],
        preferredLanguage,
        query,
        maxImagesPerOffer,
      };
      const output = runOfferFormatterAgent(input);
      return toonEncode({
        leadText: output.leadText,
        offerBlocks: output.offerBlocks,
      });
    },
  });

  return { formatPropertyOffer };
}
