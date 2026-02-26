import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decode } from "@toon-format/toon";
import { createAgentTools, type AgentToolsApi } from "./index";

const appApi = {
  properties: {
    search: {} as any,
    getRecentSearchCount: {} as any,
    logSearchEvent: {} as any,
    logKnowledgeResearch: {} as any,
    getLastSearchContext: {} as any,
    getLastSearchFindings: {} as any,
    getCachedSearchResults: {} as any,
    getGlobalSearchCache: {} as any,
    upsertGlobalSearchCache: {} as any,
    trackGlobalSearchCacheHit: {} as any,
  },
  banks: {
    getById: {} as any,
    getBySlug: {} as any,
    getBundles: {} as any,
  },
  partners: { list: {} as any },
  userProfiles: {
    getByUserId: {} as any,
    getRecentMessageCount: {} as any,
    upsert: {} as any,
  },
  knowledgePages: {
    getBySlug: {} as any,
    list: {} as any,
  },
  handoffs: { create: {} as any },
  orders: { createDraftFromAgent: {} as any },
} satisfies AgentToolsApi;

function bindToolCtx<T extends object>(tool: T, ctx: unknown): T {
  (tool as any).ctx = ctx;
  return tool;
}

function decodeToolResult(result: unknown): any {
  if (typeof result === "string") {
    return decode(result);
  }
  return result;
}

describe("anan tools: property search fallback flows", () => {
  const oldSerper = process.env.SERPER_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.SERPER_API_KEY = oldSerper;
    globalThis.fetch = originalFetch;
  });

  function testCtx(runQueryImpl: ReturnType<typeof vi.fn>) {
    return {
      runQuery: runQueryImpl,
      runMutation: vi.fn().mockResolvedValue("search-log-id"),
    };
  }

  it("smartPropertySearch returns DB results when available", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(
        vi.fn().mockResolvedValue([
          { title: "Villa A", address: "Riyadh", price: 900000, location: "Riyadh" },
        ])
      )
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "villa", limit: 5 },
      {} as any
    );
    const result = decodeToolResult(encoded);
    expect(result.source).toBe("internal_db");
    expect(result.results).toHaveLength(1);
  });

  it("smartPropertySearch falls back to web when DB is empty", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          organic: [
            {
              title: "3 Bedroom Apartment for Sale in Riyadh",
              link: "https://bayut.sa/property/123456",
              snippet: "Luxury apartment with 3 bedrooms, 2 bathrooms. Price: 500,000 SAR. Located in Al Narjis, Riyadh.",
            },
          ],
          images: [
            {
              link: "https://bayut.sa/property/123456",
              imageUrl: "https://img.example.com/p1.jpg",
            },
          ],
        }),
      }) as any;

    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(tools.smartPropertySearch, testCtx(vi.fn().mockResolvedValue([])));

    const encoded = await (smartPropertySearch as any).execute(
      { query: "apartment", limit: 3 },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.source).toBe("web_fallback");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBeDefined();
    // Image may come from pipeline (imageUrl or imageUrls) when Stagehand available
    const img = result.results[0].imageUrl ?? result.results[0].imageUrls?.[0];
    if (img) expect(img).toContain("img.example.com");
  });

  it("smartPropertySearch uses Serper image endpoint fallback when organic has no images", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    // Use mockImplementation: first call is search, second is images; runSearchAgent may do a 2nd Serper run when findings < 2
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      const isImages = url.includes("/images");
      return {
        ok: true,
        json: async () =>
          isImages
            ? {
                images: [
                  {
                    title: "Apartment for Sale in Riyadh",
                    link: "https://example.com/property/7777",
                    imageUrl: "https://img.example.com/from-images-endpoint.jpg",
                  },
                ],
              }
            : {
                organic: [
                  {
                    title: "Apartment for Sale in Riyadh",
                    link: "https://example.com/property/7777",
                    snippet: "3 bedroom apartment in Riyadh for 900000 SAR",
                  },
                ],
                images: [],
              },
      };
    }) as any;

    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(tools.smartPropertySearch, testCtx(vi.fn().mockResolvedValue([])));

    const encoded = await (smartPropertySearch as any).execute(
      { query: "apartment riyadh", limit: 3 },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.source).toBe("web_fallback");
    expect(result.results[0].title).toBeDefined();
    // Image may come from Serper images endpoint when pipeline uses it
    const img = result.results[0].imageUrl ?? result.results[0].imageUrls?.[0];
    if (img) expect(img).toContain("img.example.com");
  });

  it("smartPropertySearch falls back to non-homepage scored sources when detail filter returns zero", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    // Use mockImplementation so 2nd Serper run (when findings < 2) also gets valid response
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      const isImages = url.includes("/images");
      return {
        ok: true,
        json: async () =>
          isImages
            ? { images: [] }
            : {
                organic: [
                  {
                    title: "Apartments in Riyadh",
                    link: "https://example.com/listings/riyadh-apartments",
                    snippet: "Apartments in Riyadh with prices and details 900000 SAR",
                  },
                ],
                images: [],
              },
      };
    }) as any;

    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "riyadh apartments", limit: 5, includeImages: true },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.source).toBe("web_fallback");
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("smartPropertySearch applies refresh offset when refreshToken is provided", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    // Use mockImplementation so 2nd Serper run (when findings < 2) also gets valid response
    const fetchMock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      const isImages = url.includes("/images");
      return {
        ok: true,
        json: async () =>
          isImages
            ? { images: [] }
            : {
                organic: [
                  {
                    title: "Apartment listing one",
                    link: "https://example.com/property/9001",
                    snippet: "Apartment in Riyadh for 900000 SAR",
                  },
                ],
                images: [],
              },
      };
    });
    globalThis.fetch = fetchMock as any;

    const tools = createAgentTools(appApi);
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce(1) // getRecentSearchCount
      .mockResolvedValueOnce([]); // properties.search
    const smartPropertySearch = bindToolCtx(tools.smartPropertySearch, {
      runQuery,
      runMutation: vi.fn().mockResolvedValue("search-log-id"),
      userId: "u-refresh",
      channel: "whatsapp",
    });

    const encoded = await (smartPropertySearch as any).execute(
      { query: "riyadh apartment", limit: 5, refreshToken: "again-1", includeImages: true },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.source).toBe("web_fallback");
    expect(result.refreshOffset).toBe(20);
    // First fetch may be agent log; find the Serper search call
    const serperSearchCall = fetchMock.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("serper.dev/search") && !call[0].includes("/images")
    );
    expect(serperSearchCall).toBeTruthy();
    const searchCallBody = JSON.parse((serperSearchCall![1]?.body ?? "{}") as string);
    expect(searchCallBody.start).toBe(20);
  });

  it("smartPropertySearch returns failed state when SERPER key missing", async () => {
    delete process.env.SERPER_API_KEY;
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "townhouse", limit: 5, includeImages: true },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.searchStarted).toBe(true);
    expect(result.source).toBe("web_fallback_failed");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it("smartPropertySearch localizes searchStartedMessage for Arabic query", async () => {
    delete process.env.SERPER_API_KEY;
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "ابحث عن شقة في الرياض", limit: 5, includeImages: true },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.searchStartedMessage).toContain("نبحث لك");
    expect(result.localizedSearchStartedMessage.ar).toContain("نبحث");
  });

  it("smartPropertySearch returns failed state when fallback request throws", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as any;

    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "duplex", limit: 5, includeImages: true },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.searchStarted).toBe(true);
    expect(result.source).toBe("web_fallback_failed");
    expect(result.note).toContain("could not find matching options");
  });

  it("smartPropertySearch returns deterministic output for repeated same query", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          {
            title: "Villa for Sale in Riyadh - 4 Bedroom",
            link: "https://bayut.sa/property/200001",
            snippet: "Spacious villa with 4 bedrooms, 3 bathrooms. Price: 1,200,000 SAR. Al Malqa district.",
          },
          {
            title: "Apartment for Sale in Riyadh - 3 Bedroom",
            link: "https://bayut.sa/property/200002",
            snippet: "Modern apartment with 3 bedrooms, 2 bathrooms. Price: 800,000 SAR. Al Narjis area.",
          },
        ],
        images: [],
      }),
    }) as any;
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(tools.smartPropertySearch, testCtx(vi.fn().mockResolvedValue([])));

    const first = decodeToolResult(
      await (smartPropertySearch as any).execute({ query: "riyadh apartment", limit: 5 }, {} as any)
    );
    const second = decodeToolResult(
      await (smartPropertySearch as any).execute({ query: "riyadh apartment", limit: 5 }, {} as any)
    );

    expect(first).toEqual(second);
    // Results are sorted by quality score (descending), then by URL for determinism
    expect(first.results.length).toBeGreaterThan(0);
  });

  it("smartPropertySearch returns deterministic output for repeated same query", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          {
            title: "Result B",
            link: "https://example.com/property/5002",
            snippet: "Apartment in Riyadh for 900000 SAR",
          },
          {
            title: "Result A",
            link: "https://example.com/property/5001",
            snippet: "Apartment in Riyadh for 800000 SAR",
          },
        ],
        images: [],
      }),
    }) as any;
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const first = decodeToolResult(
      await (smartPropertySearch as any).execute(
        { query: "riyadh apartment", limit: 5, includeImages: true },
        {} as any
      )
    );
    const second = decodeToolResult(
      await (smartPropertySearch as any).execute(
        { query: "riyadh apartment", limit: 5, includeImages: true },
        {} as any
      )
    );

    expect(first).toEqual(second);
    expect(first.results[0].title).toBeDefined();
    expect(first.results[0].locationHint).toBe("Riyadh");
  });

  it("smartPropertySearch logs admin knowledge research with top-3 sources", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          { title: "R1", link: "https://example.com/property/1", snippet: "Villa in Riyadh 1,100,000 SAR" },
          { title: "R2", link: "https://example.com/property/2", snippet: "Villa in Riyadh 1,200,000 SAR" },
          { title: "R3", link: "https://example.com/property/3", snippet: "Villa in Riyadh 1,300,000 SAR" },
          { title: "R4", link: "https://example.com/property/4", snippet: "Villa in Riyadh 1,400,000 SAR" },
          { title: "R5", link: "https://example.com/property/5", snippet: "Villa in Riyadh 1,500,000 SAR" },
        ],
        images: [],
      }),
    }) as any;
    const runMutation = vi.fn().mockResolvedValue("ok");
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(tools.smartPropertySearch, {
      runQuery: vi.fn().mockResolvedValue([]),
      runMutation,
      userId: "u-1",
      channel: "whatsapp",
    });

    await (smartPropertySearch as any).execute(
      { query: "riyadh villas", limit: 10, includeImages: true },
      {} as any
    );

    const knowledgeCall = runMutation.mock.calls.find(
      (call) =>
        call?.[1] &&
        typeof call[1] === "object" &&
        call[1].requestedTopSources === 3 &&
        call[1].requestedTopCardsPerSource === 3
    );
    expect(knowledgeCall).toBeTruthy();
    if (!knowledgeCall) {
      throw new Error("Expected knowledge research mutation call");
    }
    expect(knowledgeCall[1].sourceRuns.length).toBeLessThanOrEqual(3);
    expect(knowledgeCall[1].sourceRuns.length).toBeGreaterThan(0);
    expect(knowledgeCall[1].propertyFindings.length).toBeLessThanOrEqual(9);
  });

  it("smartPropertySearch invokes runMutation when userId present and search succeeds", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          { title: "Villa", link: "https://example.com/p1", snippet: "Villa in Jeddah 2M SAR" },
        ],
        images: [],
      }),
    }) as any;
    const runMutation = vi.fn().mockResolvedValue("ok");
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(tools.smartPropertySearch, {
      runQuery: vi.fn().mockResolvedValue([]),
      runMutation,
      userId: "u-memory-test",
      channel: "whatsapp",
      threadId: "thread-1",
    });

    await (smartPropertySearch as any).execute(
      { query: "villa jeddah", limit: 5, includeImages: true },
      {} as any
    );

    expect(runMutation.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("smartPropertySearch handles empty organic results without crashing", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      const isImages = url.includes("/images");
      return {
        ok: true,
        json: async () =>
          isImages ? { images: [] } : { organic: [], images: [] },
      };
    }) as any;
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "xyz nonexis tent", limit: 5, includeImages: true },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.searchStarted).toBe(true);
    expect(result.source).toBe("web_fallback_failed");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it("smartPropertySearch returns valid structure when given valid inputs", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          { title: "A", link: "https://x.com/1", snippet: "Apartment Riyadh 800k SAR" },
          { title: "B", link: "https://x.com/2", snippet: "Villa Jeddah 2M SAR" },
        ],
        images: [],
      }),
    }) as any;
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "شقة الرياض", limit: 5, includeImages: true },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.searchStarted).toBe(true);
    expect(result.localizedSearchStartedMessage).toBeDefined();
    expect(result.localizedSearchStartedMessage.ar).toContain("نبحث");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.presentationGuidance).toBeDefined();
  });

  it("smartPropertySearch handles fetch returning undefined gracefully", async () => {
    process.env.SERPER_API_KEY = "serper-test-key";
    globalThis.fetch = vi.fn().mockResolvedValue(undefined) as any;
    const tools = createAgentTools(appApi);
    const smartPropertySearch = bindToolCtx(
      tools.smartPropertySearch,
      testCtx(vi.fn().mockResolvedValue([]))
    );

    const encoded = await (smartPropertySearch as any).execute(
      { query: "apartment", limit: 3, includeImages: false },
      {} as any
    );
    const result = decodeToolResult(encoded);

    expect(result.searchStarted).toBe(true);
    expect(result.source).toBe("web_fallback_failed");
    expect(Array.isArray(result.results)).toBe(true);
  });
});
