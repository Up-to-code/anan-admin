import type { Id } from "convex/_generated/dataModel";

export type AgentThread = {
  _id: string;
  _creationTime: number;
  title?: string;
};

export type AgentMessageStatus = "streaming" | "finished" | "aborted";

export type AdminTaskScope =
  | "users"
  | "orders"
  | "properties"
  | "banks"
  | "knowledge"
  | "prompts"
  | "analytics"
  | "system";

export type AdminTaskMode = "plan_then_execute" | "plan_only" | "execute_only" | "audit";

export type AdminTaskOutputStyle = "brief" | "detailed" | "checklist";

export type AdminTaskRequest = {
  threadId?: string;
  goal: string;
  scope: AdminTaskScope;
  mode: AdminTaskMode;
  outputStyle: AdminTaskOutputStyle;
  context?: string;
  acceptanceCriteria?: string[];
  requirements: {
    needUi: boolean;
    needBackend: boolean;
    needTests: boolean;
    needRisks: boolean;
    needRollback: boolean;
    needMetrics: boolean;
  };
};

export type AgentMessage = {
  id: string;
  content: string;
  isAi: boolean;
  status?: AgentMessageStatus;
  parts?: unknown[];
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
    }
  | {
      type: "engagement";
      conversationObjective?: string;
      missingFields?: Array<{
        key: string;
        label: string;
        required: boolean;
        value?: string;
      }>;
      suggestedActions?: Array<{
        id: string;
        label: string;
        action: string;
        payload?: unknown;
      }>;
      responseSections?: {
        answer?: string;
        details?: string[];
        nextStep?: string;
      };
      progressStage?:
        | "analyzing"
        | "memory"
        | "searching"
        | "validating"
        | "formatting";
    };
