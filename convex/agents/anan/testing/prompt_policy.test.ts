import { afterEach, describe, expect, it } from "vitest";
import { buildAgentInstructions, PROMPT_POLICY_VERSION } from "../instructions";

const ORIGINAL_FLAG = process.env.PROMPT_POLICY_V2_ENABLED;

afterEach(() => {
  process.env.PROMPT_POLICY_V2_ENABLED = ORIGINAL_FLAG;
});

describe("prompt policy v0.0.9", () => {
  it("includes policy version marker and strict priority stack", () => {
    process.env.PROMPT_POLICY_V2_ENABLED = "true";
    const prompt = buildAgentInstructions("web");
    expect(prompt).toContain(`PROMPT_POLICY_VERSION: ${PROMPT_POLICY_VERSION}`);
    expect(prompt).toContain("INSTRUCTION_PRIORITY_STACK:");
    expect(prompt).toContain("1) identity+safety+language");
    expect(prompt).toContain("2) routing+tools");
    expect(prompt).toContain("3) memory+recall");
    expect(prompt).toContain("4) response contract");
    expect(prompt).toContain("5) channel adapter");
  });

  it("applies exactly one channel adapter when v2 is enabled", () => {
    process.env.PROMPT_POLICY_V2_ENABLED = "true";
    const waPrompt = buildAgentInstructions("whatsapp");
    const webPrompt = buildAgentInstructions("web");
    expect(waPrompt).toContain("**WhatsApp Adapter**");
    expect(waPrompt).not.toContain("**Web Adapter**");
    expect(webPrompt).toContain("**Web Adapter**");
    expect(webPrompt).not.toContain("**WhatsApp Adapter**");
  });

  it("returns legacy-compatible prompt when v2 flag is disabled", () => {
    process.env.PROMPT_POLICY_V2_ENABLED = "false";
    const prompt = buildAgentInstructions("whatsapp");
    expect(prompt).toContain("**WhatsApp Adapter**");
    expect(prompt).not.toContain("INSTRUCTION_PRIORITY_STACK:");
  });

  it("does not include vendor/provider brand names in policy text", () => {
    process.env.PROMPT_POLICY_V2_ENABLED = "true";
    const prompt = buildAgentInstructions("app").toLowerCase();
    expect(prompt).not.toContain("bayut");
    expect(prompt).not.toContain("property finder");
    expect(prompt).not.toContain("wasalt");
    expect(prompt).not.toContain("aqar");
  });
});
