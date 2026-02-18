"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  PanelRightOpen,
  PenSquare,
  Sidebar,
  Sparkles,
  X,
} from "lucide-react";
import type { Id } from "convex/_generated/dataModel";
import type { AdminTaskRequest, AgentMessage, AgentThread, PendingAction } from "./types";
import { ConversationRail } from "./ConversationRail";
import { ChatCanvas } from "./ChatCanvas";
import { PendingActionPanel } from "./PendingActionPanel";
import { AdminHelperPanel } from "./AdminHelperPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  onSendTask,
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
  onSendTask: (task: AdminTaskRequest) => void;
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
  const [utilityOpen, setUtilityOpen] = useState(true);
  const [utilityTab, setUtilityTab] = useState<"helper" | "actions">("helper");
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
        <span className="font-semibold text-sm">AI Admin Helper</span>
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
          onThreadChosen={() => setRailOpen(false)}
        />
      </div>
    </div>
  );

  const utilityContent = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={utilityTab === "helper" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setUtilityTab("helper")}
          >
            <Sparkles size={14} />
            المساعد
          </Button>
          <Button
            type="button"
            size="sm"
            variant={utilityTab === "actions" ? "default" : "ghost"}
            className="gap-1.5"
            onClick={() => setUtilityTab("actions")}
          >
            <PanelRightOpen size={14} />
            الإجراءات
            {sortedPending.length > 0 ? (
              <Badge variant="secondary" className="h-5 px-1 text-[10px]">
                {sortedPending.length}
              </Badge>
            ) : null}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setUtilityOpen(false)}
          className="xl:hidden"
        >
          <X size={16} />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {utilityTab === "helper" ? (
          <AdminHelperPanel
            isBusy={isBusy}
            pendingCount={sortedPending.length}
            onRunPrompt={onSendMessage}
            onRunTask={onSendTask}
          />
        ) : (
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
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen text-foreground relative flex overflow-hidden bg-background" dir="rtl">
      {/* Mobile/Tablet Conversation Rail */}
      {railOpen && (
        <div className="absolute inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setRailOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-3/4 max-w-xs border-l border-border bg-background animate-in slide-in-from-right">
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

      {/* Desktop Conversation Rail */}
      <aside className="hidden md:flex w-[280px] flex-col border-l border-border bg-card/30">
        {railContent}
      </aside>

      <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-transparent relative">
        <div className="h-14 flex items-center justify-between px-4 bg-transparent z-10 transition-colors duration-200">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => setRailOpen(true)}
            >
              <Sidebar size={18} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-foreground md:hidden">
                <Bot size={18} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm md:hidden">AI Admin Helper</span>
                <span className="text-xs text-muted-foreground">
                  {sortedPending.length > 0
                    ? `${sortedPending.length} إجراءات معلقة`
                    : "مساحة المحادثة"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 relative h-9 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => {
                setUtilityTab("helper");
                setUtilityOpen(true);
              }}
            >
              <Sparkles size={16} />
              <span className="hidden md:inline">المساعد</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 relative h-9 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => {
                setUtilityTab("actions");
                setUtilityOpen(true);
              }}
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

        <ChatCanvas
          messages={messages}
          isThinking={isThinking}
          isSending={isSending}
          onSend={onSendMessage}
          onSlashCommand={onSlashCommand}
          onOpenPendingActions={() => {
            setUtilityTab("actions");
            setUtilityOpen(true);
          }}
          bottomRef={bottomRef}
        />
      </main>

      {/* Desktop Utility Workspace */}
      {utilityOpen ? (
        <aside className="hidden xl:flex w-[380px] border-r border-border bg-background">
          {utilityContent}
        </aside>
      ) : null}

      {/* Mobile/Tablet Utility Drawer */}
      {utilityOpen ? (
        <div className="absolute inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setUtilityOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-full max-w-md border-r border-border bg-background animate-in slide-in-from-left">
            {utilityContent}
          </div>
        </div>
      ) : null}
    </div>
  );
}
