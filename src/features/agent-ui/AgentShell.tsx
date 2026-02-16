"use client";

import { useMemo, useState } from "react";
import { PanelRightOpen, Sidebar, X } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";
import type { AgentMessage, AgentThread, PendingAction } from "./types";
import { ConversationRail } from "./ConversationRail";
import { ChatCanvas } from "./ChatCanvas";
import { PendingActionPanel } from "./PendingActionPanel";
import "./agent-ui.css";

export function AgentShell({
  threads,
  activeThreadId,
  messages,
  pendingActions,
  isThreadsLoading,
  isSending,
  isThinking,
  deletingThreadId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  onSendMessage,
  onSlashCommand,
  onRewriteText,
  onUpdatePendingPayload,
  onConfirmPendingAction,
  onCancelPendingAction,
  onGenerateUploadUrl,
  onAttachPendingMedia,
  onRemovePendingMedia,
  onReorderPendingMedia,
  bottomRef,
}: {
  threads: AgentThread[];
  activeThreadId: string | null;
  messages: AgentMessage[];
  pendingActions: PendingAction[];
  isThreadsLoading: boolean;
  isSending: boolean;
  isThinking: boolean;
  deletingThreadId: string | null;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => Promise<unknown>;
  onSendMessage: (value: string) => void;
  onSlashCommand: (command: "rewrite" | "formal" | "summarize", text: string) => Promise<string>;
  onRewriteText: (mode: "rewrite" | "formal" | "summarize", text: string) => Promise<string>;
  onUpdatePendingPayload: (actionId: Id<"adminPendingActions">, payload: unknown) => Promise<void>;
  onConfirmPendingAction: (actionId: Id<"adminPendingActions">, payload?: unknown) => Promise<void>;
  onCancelPendingAction: (actionId: Id<"adminPendingActions">) => Promise<void>;
  onGenerateUploadUrl: (actionId: Id<"adminPendingActions">) => Promise<string>;
  onAttachPendingMedia: (
    actionId: Id<"adminPendingActions">,
    storageId: Id<"_storage">,
    kind: "image" | "logo"
  ) => Promise<void>;
  onRemovePendingMedia: (mediaId: Id<"entityMedia">) => Promise<void>;
  onReorderPendingMedia: (
    actionId: Id<"adminPendingActions">,
    mediaIds: Id<"entityMedia">[]
  ) => Promise<void>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [railOpen, setRailOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const isBusy = isSending || isThinking;
  const sortedPending = useMemo(
    () => [...pendingActions].sort((a, b) => b._creationTime - a._creationTime),
    [pendingActions]
  );

  return (
    <div className="agent-root" dir="rtl">
      <div className="agent-shell">
        <aside className="agent-rail agent-desktop-only">
          <ConversationRail
            threads={threads}
            activeThreadId={activeThreadId}
            isLoading={isThreadsLoading}
            isBusy={isBusy}
            deletingThreadId={deletingThreadId}
            onNewThread={onNewThread}
            onSelectThread={onSelectThread}
            onDeleteThread={onDeleteThread}
            onRenameThread={onRenameThread}
          />
        </aside>

        <section className="agent-main">
          <div className="agent-topbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <div className="agent-topbar-left">
              <button className="agent-btn icon ghost agent-mobile-only" onClick={() => setRailOpen(true)}>
                <Sidebar size={16} />
              </button>
              <div>
                <div className="agent-title">وكيل ANAN</div>
                <div className="agent-subtitle">
                  {sortedPending.length > 0
                    ? `${sortedPending.length} إجراءات معلقة`
                    : "مساحة المحادثة"}
                </div>
              </div>
            </div>
            <div className="agent-inline-row">
              <button className="agent-btn icon ghost" onClick={() => setActionsOpen(true)}>
                <PanelRightOpen size={16} />
              </button>
              <button className="agent-btn ghost" onClick={onNewThread} disabled={isBusy}>
                محادثة جديدة
              </button>
            </div>
          </div>

          <ChatCanvas
            messages={messages}
            isThinking={isThinking}
            isSending={isSending}
            onSend={onSendMessage}
            onSlashCommand={onSlashCommand}
            bottomRef={bottomRef}
          />
        </section>

      </div>

      {railOpen ? (
        <>
          <div className="agent-drawer-overlay" onClick={() => setRailOpen(false)} />
          <div className="agent-drawer-panel">
            <div className="agent-topbar">
              <div className="agent-title">المحادثات</div>
              <button className="agent-btn icon ghost" onClick={() => setRailOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <ConversationRail
              threads={threads}
              activeThreadId={activeThreadId}
              isLoading={isThreadsLoading}
              isBusy={isBusy}
              deletingThreadId={deletingThreadId}
              onNewThread={onNewThread}
              onSelectThread={onSelectThread}
              onDeleteThread={onDeleteThread}
              onRenameThread={onRenameThread}
              onThreadChosen={() => setRailOpen(false)}
            />
          </div>
        </>
      ) : null}

      {actionsOpen ? (
        <>
          <div className="agent-drawer-overlay" onClick={() => setActionsOpen(false)} />
          <div className="agent-drawer-panel">
            <div className="agent-topbar">
              <div className="agent-title">الإجراءات المعلقة</div>
              <button className="agent-btn icon ghost" onClick={() => setActionsOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <PendingActionPanel
              actions={sortedPending}
              updatePayload={onUpdatePendingPayload}
              confirmAction={onConfirmPendingAction}
              rewriteText={onRewriteText}
              cancelAction={onCancelPendingAction}
              generateUploadUrl={onGenerateUploadUrl}
              attachMedia={onAttachPendingMedia}
              removeMedia={onRemovePendingMedia}
              reorderMedia={onReorderPendingMedia}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
