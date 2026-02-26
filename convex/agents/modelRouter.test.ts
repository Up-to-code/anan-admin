import { describe, expect, it } from "vitest";
import {
  parseModelTrafficSplit,
  selectModelByRoutingKey,
} from "./modelRouter";

describe("modelRouter", () => {
  it("parses weighted routes", () => {
    const routes = parseModelTrafficSplit(
      "openrouter/model-a:70,openrouter/model-b:30",
    );
    expect(routes).toEqual([
      { model: "openrouter/model-a", weight: 70 },
      { model: "openrouter/model-b", weight: 30 },
    ]);
  });

  it("ignores malformed entries", () => {
    const routes = parseModelTrafficSplit(
      "bad-entry,openrouter/model-a:foo,openrouter/model-b:20",
    );
    expect(routes).toEqual([{ model: "openrouter/model-b", weight: 20 }]);
  });

  it("selects deterministic model by routing key", () => {
    const routes = parseModelTrafficSplit(
      "openrouter/model-a:50,openrouter/model-b:50",
    );
    const first = selectModelByRoutingKey(routes, "thread-123");
    const second = selectModelByRoutingKey(routes, "thread-123");
    expect(first).toBe(second);
  });

  it("parses model ids that include ':free'", () => {
    const routes = parseModelTrafficSplit(
      "stepfun/step-3.5-flash:free:40,arcee-ai/trinity-large-preview:free:60",
    );
    expect(routes).toEqual([
      { model: "stepfun/step-3.5-flash:free", weight: 40 },
      { model: "arcee-ai/trinity-large-preview:free", weight: 60 },
    ]);
  });
});
