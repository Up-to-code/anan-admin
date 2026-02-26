import { describe, expect, it } from "vitest";
import { buildSearchExecutionPlan } from "./queryPlanner";

describe("queryPlanner", () => {
  it("builds a balanced plan by default", () => {
    const previous = process.env.SEARCH_ORCH_PROFILE;
    delete process.env.SEARCH_ORCH_PROFILE;
    const plan = buildSearchExecutionPlan({
      query: "apartments in Riyadh",
      limit: 5,
      offset: 0,
    });
    if (previous === undefined) {
      delete process.env.SEARCH_ORCH_PROFILE;
    } else {
      process.env.SEARCH_ORCH_PROFILE = previous;
    }
    expect(plan.profile).toBe("balanced");
    expect(plan.intent).toBe("property_search");
    expect(plan.queryVariants.length).toBeGreaterThan(1);
  });

  it("adds refresh task note when offset exists", () => {
    const plan = buildSearchExecutionPlan({
      query: "apartments in Riyadh",
      limit: 5,
      offset: 10,
      refreshToken: "more",
    });
    expect(plan.taskList.some((task) => task.includes("offset=10"))).toBe(true);
  });
});
