import { describe, expect, it } from "vitest";
import { runOfferFormatterAgent } from "./offerFormatter";

describe("runOfferFormatterAgent", () => {
  it("cleans noisy Arabic offer fields and normalizes weak price/location", () => {
    const result = runOfferFormatterAgent({
      preferredLanguage: "ar",
      query: "أبغى فيلا في الرياض بحدود 1200000 ريال",
      offerBlocks: [
        {
          text: "1. عرض عقاري\n- السعر: 336\n- الموقع: Ar Riyadh\n- Villas for sale in Ar Riyadh ; listing 1 ; listing 2 ; listing 3",
          imageUrl: "https://img.example.com/1.jpg",
          imageUrls: [
            "https://img.example.com/1.jpg",
            "https://img.example.com/2.jpg",
          ],
        },
      ],
    });

    expect(result.offerBlocks[0].text).toContain("السعر: 1200000 ريال");
    expect(result.offerBlocks[0].text).toContain("الموقع: الرياض");
    expect(result.offerBlocks[0].imageUrls).toEqual([
      "https://img.example.com/1.jpg",
      "https://img.example.com/2.jpg",
    ]);
  });

  it("returns polished English lead text and CTA", () => {
    const result = runOfferFormatterAgent({
      preferredLanguage: "en",
      query: "Show me another result for Riyadh apartment",
      offerBlocks: [
        {
          text: "1. Property offer\n- Price: 950000 SAR\n- Location: Riyadh\n- Beautiful apartment near schools and parks.",
        },
      ],
    });

    expect(result.leadText).toContain("cleaned and refined");
    expect(result.leadText).toContain("If you want full details or to book a viewing");
  });
});
