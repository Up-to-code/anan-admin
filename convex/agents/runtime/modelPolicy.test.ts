import { afterEach, describe, expect, it } from "vitest";
import { assertProductionModelPolicy, isFreeModelId } from "./modelPolicy";

describe("modelPolicy", () => {
  const previousEnv = process.env.AGENT_ENV;

  afterEach(() => {
    if (previousEnv === undefined) delete process.env.AGENT_ENV;
    else process.env.AGENT_ENV = previousEnv;
  });

  it("detects free model suffix", () => {
    expect(isFreeModelId("stepfun/step-3.5-flash:free")).toBe(true);
    expect(isFreeModelId("openai/gpt-4o")).toBe(false);
  });

  it("throws in production when free models are present", () => {
    process.env.AGENT_ENV = "production";
    expect(() =>
      assertProductionModelPolicy({
        selectedModel: "google/gemini-2.5-flash",
        fallbacks: ["stepfun/step-3.5-flash:free", "openai/gpt-4o"],
      }),
    ).toThrow(/free models/i);
  });

  it("does not throw in production when chain is paid-only", () => {
    process.env.AGENT_ENV = "production";
    expect(() =>
      assertProductionModelPolicy({
        selectedModel: "google/gemini-2.5-flash",
        fallbacks: ["openai/gpt-4o", "anthropic/claude-sonnet-4.6"],
      }),
    ).not.toThrow();
  });
});
