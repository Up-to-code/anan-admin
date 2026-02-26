import { describe, expect, it } from "vitest";
import { shouldRetrySend } from "./send_executor";

describe("shouldRetrySend", () => {
  it("retries for retryable provider errors", () => {
    expect(shouldRetrySend("429 rate limit")).toBe(true);
    expect(shouldRetrySend("503 temporarily unavailable")).toBe(true);
    expect(shouldRetrySend("network timeout")).toBe(true);
  });

  it("does not retry for terminal validation errors", () => {
    expect(shouldRetrySend("400 invalid recipient")).toBe(false);
    expect(shouldRetrySend("forbidden")) .toBe(false);
    expect(shouldRetrySend(undefined)).toBe(false);
  });
});
