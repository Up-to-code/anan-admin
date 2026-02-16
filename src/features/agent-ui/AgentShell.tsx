"use client";

import { useMemo, useState } from "react";
import { Bot, PanelRightOpen, PenSquare, Sidebar, X } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";
import type { AgentMessage, AgentThread, PendingAction } from "./types";
import { ConversationRail } from "./ConversationRail";
import { ChatCanvas } from "./ChatCanvas";
import { PendingActionPanel } from "./PendingActionPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

  const railContent = (
    <div className="flex flex-col h-full min-h-0 bg-transparent">
      <div className="flex shrink-0 items-center gap-2 p-4">
        <div className="w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center text-foreground/80">
          <Bot size={18} />
        </div>
        <span className="font-semibold text-sm">وكيل ANAN</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
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
      </div>
    </div>
  );

  const actionsContent = (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-background border-l border-border">
      <div className="flex shrink-0 items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm">الإجراءات المعلقة</h3>
        <Button variant="ghost" size="icon" onClick={() => setActionsOpen(false)}>
          <X size={16} />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
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
    </div>
  );

  return (
    <div className="h-screen text-foreground relative flex overflow-hidden bg-background" dir="rtl">
      {/* Mobile/Tablet Sidebar Overlay */}
      {railOpen && (
        <div className="absolute inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setRailOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-3/4 max-w-xs bg-sidebar-background shadow-2xl border-l border-border animate-in slide-in-from-right">
            {railContent}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 left-2 text-muted-foreground hover:text-foreground"
              onClick={() => setRailOpen(false)}
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar - Strictly Dark Mode style (Hybrid Layout) */}
      <aside className="hidden md:flex w-[260px] flex-col border-l border-white/10 bg-black text-white">
        {railContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-transparent relative">
        {/* Topbar */}
        <div className="h-14 flex items-center justify-between px-4 bg-transparent z-10 transition-colors duration-200">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => setRailOpen(true)}>
              <Sidebar size={18} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-foreground md:hidden">
                <Bot size={18} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm md:hidden">وكيل ANAN</span>
                <span className="text-xs text-muted-foreground">
                  {sortedPending.length > 0 ? `${sortedPending.length} إجراءات معلقة` : "مساحة المحادثة"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 relative h-9 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => setActionsOpen(true)}
            >
              <PanelRightOpen size={16} />
              {sortedPending.length > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full text-[10px]">
                  {sortedPending.length}
                </Badge>
              )}
            </Button>
            <Button
              size="sm"
              onClick={onNewThread}
              disabled={isBusy}
              className="gap-2 h-9 border-0"
            >
              <PenSquare size={16} />
              <span className="hidden sm:inline">محادثة جديدة</span>
            </Button>
          </div>
        </div>

        {/* Chat Area */}
        <ChatCanvas
          messages={messages}
          isThinking={isThinking}
          isSending={isSending}
          onSend={onSendMessage}
          onSlashCommand={onSlashCommand}
          onOpenPendingActions={() => setActionsOpen(true)}
          bottomRef={bottomRef}
        />
      </main>

      {/* Actions Panel (Drawer) */}
      {actionsOpen && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setActionsOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-full max-w-md bg-background shadow-2xl border-r border-border animate-in slide-in-from-left flex flex-col min-h-0">
            {actionsContent}
          </div>
        </div>
      )}
    </div>
  );
}
