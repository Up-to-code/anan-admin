import { v } from "convex/values";

export const CHANNEL_VALIDATOR = v.union(
  v.literal("whatsapp"),
  v.literal("app"),
  v.literal("web"),
);

export type AgentChannel = "whatsapp" | "app" | "web";

export const THREAD_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const WHATSAPP_THREAD_MAX_IDLE_MS = 1000 * 60 * 60 * 24;
