import { describe, expect, it } from "vitest";
import { inferMemoryFactsFromMessage } from "./inference";

describe("inferMemoryFactsFromMessage", () => {
  it("extracts name, budget, location, and bedrooms", () => {
    const facts = inferMemoryFactsFromMessage(
      "Hi, my name is Ahmed. I need 3 bed in Riyadh with budget 1200000.",
    );
    const asMap = new Map(facts.map((f) => [f.key, f.value]));
    expect(asMap.get("user_name")).toBe("Ahmed");
    expect(asMap.get("bedrooms_preference")).toBe("3");
    expect(asMap.get("location_preference")).toContain("Riyadh");
    expect(asMap.get("budget_preference")).toBe("1200000");
  });

  it("extracts explicit remember note", () => {
    const facts = inferMemoryFactsFromMessage(
      "Remember that I prefer quiet neighborhoods.",
    );
    const note = facts.find((f) => f.key === "user_note");
    expect(note?.value).toContain("prefer quiet neighborhoods");
  });

  it("captures unexpected personal fact using user_fact key", () => {
    const facts = inferMemoryFactsFromMessage("My favorite color is green");
    const fact = facts.find((f) => f.key === "user_fact_favorite_color");
    expect(fact?.value).toBe("green");
  });

  it("captures call-me name and financing preference", () => {
    const facts = inferMemoryFactsFromMessage(
      "Call me Mansour. I am a cash buyer for now.",
    );
    const asMap = new Map(facts.map((f) => [f.key, f.value]));
    expect(asMap.get("user_name")).toBe("Mansour");
    expect(asMap.get("financing_preference")).toBe("cash");
  });

  it("captures timeline and contact preference", () => {
    const facts = inferMemoryFactsFromMessage(
      "I want to buy within 3 months, contact me on WhatsApp only.",
    );
    const asMap = new Map(facts.map((f) => [f.key, f.value]));
    expect(asMap.get("purchase_timeline")).toContain("3 month");
    expect(asMap.get("contact_preference")).toContain("WhatsApp");
  });
});
