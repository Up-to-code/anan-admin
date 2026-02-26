import { describe, expect, it } from "vitest";
import { buildBayutSearchUrl } from "./bayut";

describe("buildBayutSearchUrl", () => {
  it("builds standard slug search URLs", () => {
    expect(buildBayutSearchUrl("شقق 3 غرف للبيع الرياض", 1)).toBe(
      "https://www.bayut.sa/s/شقق-3-غرف-للبيع-الرياض/",
    );
    expect(buildBayutSearchUrl("شقق 3 غرف للبيع الرياض", 2)).toBe(
      "https://www.bayut.sa/s/شقق-3-غرف-للبيع-الرياض/صفحة-2/",
    );
  });

  it("uses provided Bayut listing URL as crawl seed and continues pagination", () => {
    const query =
      "https://www.bayut.sa/s/شقق-3-غرف-للبيع-السعودية-بأقل-من-1300000-ريال/صفحة-8/";
    expect(buildBayutSearchUrl(query, 1)).toBe(
      "https://www.bayut.sa/s/شقق-3-غرف-للبيع-السعودية-بأقل-من-1300000-ريال/صفحة-8/",
    );
    expect(buildBayutSearchUrl(query, 2)).toBe(
      "https://www.bayut.sa/s/شقق-3-غرف-للبيع-السعودية-بأقل-من-1300000-ريال/صفحة-9/",
    );
  });
});
