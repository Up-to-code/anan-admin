import { describe, expect, it } from "vitest";
import { detectSearchIntent, detectSearchScope } from "./intentScope";

describe("intentScope", () => {
  it("detects property search intent by default", () => {
    expect(detectSearchIntent("apartments in Riyadh under 1m")).toBe("property_search");
  });

  it("detects loan intent", () => {
    expect(detectSearchIntent("best mortgage rates in saudi")).toBe("loan");
  });

  it("detects market intent", () => {
    expect(detectSearchIntent("real estate market trends in jeddah")).toBe("market_info");
  });

  it("detects saudi scope", () => {
    expect(detectSearchScope("فلل للبيع في الرياض")).toBe("saudi");
  });

  it("detects uae scope", () => {
    expect(detectSearchScope("apartments for sale in Dubai")).toBe("uae");
  });
});
