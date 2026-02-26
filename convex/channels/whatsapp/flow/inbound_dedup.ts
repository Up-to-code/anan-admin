import { internal } from "../../../_generated/api";
import type { DataModel } from "../../../_generated/dataModel";
import type { GenericActionCtx } from "convex/server";

export type Ctx = GenericActionCtx<DataModel>;

export function markEventKey(input: {
  type: "message" | "reaction";
  id?: string;
  fallback: string;
}): string {
  if (input.id) return `${input.type}:${input.id}`;
  return `${input.type}:fallback:${input.fallback}`;
}

function getInternalRef(path: string): any {
  return path.split(".").reduce((acc: any, key) => acc?.[key], internal as any);
}

export async function markInboundProcessing(
  ctx: Ctx,
  args: {
    providerEventId: string;
    userId?: string;
    eventType: "message" | "reaction";
    messageId?: string;
  },
): Promise<boolean> {
  const ref = getInternalRef("services.whatsappEvents.markInboundProcessing");
  if (!ref) return true;
  const result = await ctx.runMutation(ref, args);
  return Boolean(result?.accepted ?? true);
}

export async function markInboundDone(ctx: Ctx, providerEventId: string): Promise<void> {
  const ref = getInternalRef("services.whatsappEvents.markInboundDone");
  if (!ref) return;
  await ctx.runMutation(ref, { providerEventId });
}

export async function markInboundFailed(
  ctx: Ctx,
  providerEventId: string,
  error: string,
): Promise<void> {
  const ref = getInternalRef("services.whatsappEvents.markInboundFailed");
  if (!ref) return;
  await ctx.runMutation(ref, { providerEventId, error });
}

export type WhatsAppInboundMessageInsert = {
  userId: string;
  providerEventId: string;
  messageId?: string;
  text: string;
  mediaType?: "text" | "audio" | "image" | "video" | "document";
  mediaId?: string;
  phoneNumberId?: string;
};

export async function insertInboundMessage(ctx: Ctx, msg: WhatsAppInboundMessageInsert): Promise<void> {
  const ref = getInternalRef("services.whatsappEvents.insertWhatsAppInboundMessage");
  if (!ref) return;
  await ctx.runMutation(ref, msg);
}

export function getServiceRef(path: string): any {
  return getInternalRef(path);
}
