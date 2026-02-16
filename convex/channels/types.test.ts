import { describe, expect, it } from "vitest";
import { detectChannel } from "./types";

describe("detectChannel", () => {
  it("detects whatsapp for webhook source", () => {
    expect(detectChannel({ type: "webhook_whatsapp" })).toBe("whatsapp");
  });

  it("detects app for convex client source", () => {
    expect(detectChannel({ type: "convex_client" })).toBe("app");
  });

  it("detects app for localhost api_chat source", () => {
    const headers = new Headers({ origin: "http://localhost:5173" });
    expect(detectChannel({ type: "api_chat", headers })).toBe("app");
  });

  it("detects web for non-local api_chat source", () => {
    const headers = new Headers({ origin: "https://anan.example.com" });
    expect(detectChannel({ type: "api_chat", headers })).toBe("web");
  });
});
