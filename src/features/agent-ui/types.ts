import type { Id } from "convex/_generated/dataModel";

export type AgentThread = {
  _id: string;
  _creationTime: number;
  title?: string;
};

export type AgentMessage = {
  id: string;
  content: string;
  isAi: boolean;
};

export type PendingAction = {
  _id: Id<"adminPendingActions">;
  _creationTime: number;
  threadId: string;
  actionType: string;
  entityType: "property" | "bank" | "partner" | "bankProduct" | "other";
  status: "pending" | "confirmed" | "cancelled" | "executed" | "failed";
  draftPayload: unknown;
  editablePayload: unknown;
  needsMedia: boolean;
  executionResult?: unknown;
};

export type PendingMedia = {
  _id: Id<"entityMedia">;
  storageId: Id<"_storage">;
  sortOrder: number;
  caption?: string;
  isPrimary?: boolean;
  url?: string | null;
};

export type AssistantPayload =
  | { type: "text"; text: string }
  | { type: "summary_block"; title: string; summary: string; count?: number; cta?: string }
  | {
      type: "recommendation_property";
      title: string;
      address?: string;
      price?: number;
      status?: string;
      description?: string;
    }
  | {
      type: "recommendation_bank";
      name: string;
      product?: string;
      description?: string;
      status?: string;
    }
  | {
      type: "recommendation_developer";
      name: string;
      slug?: string;
      description?: string;
      status?: string;
    }
  | {
      type: "action_state";
      state: "pending" | "confirmed" | "cancelled" | "executed" | "failed";
      title: string;
      details?: string;
    };
