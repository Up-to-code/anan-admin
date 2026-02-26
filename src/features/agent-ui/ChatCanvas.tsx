"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Bot } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";
import { ar } from "@/lib/ar";
import { Button } from "@/components/ui/button";
import type { AgentMessage, PendingAction } from "./types";
import { MessageBubbleHuman } from "./MessageBubbleHuman";
import { MessageBubbleAgent } from "./MessageBubbleAgent";
import { Composer } from "./Composer";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { Separator } from "@/components/ui/separator";
import { PendingActionPanel } from "./PendingActionPanel";
import { parseAssistantPayload } from "./parseAssistantPayload";
import { Badge } from "@/components/ui/badge";

const SUGGESTED_PROMPTS = [
  "أنشئ عقارا جديدا من هذا الوصف",
  "أضف بنكا جديدا مع البيانات الأساسية والشعار",
  "اقترح ثلاث عقارات مناسبة لعائلة في الرياض",
  "راجع الإجراءات المعلقة وأخبرني بما يحتاج تأكيد",
] as const;

export function ChatCanvas({
  messages,
  pendingActions,
  isThinking,
  isSending,
  onSend,
  onSlashCommand,
  onUpdatePendingPayload,
  onConfirmPendingAction,
  onCancelPendingAction,
  onGenerateUploadUrl,
  onAttachPendingMedia,
  onRemovePendingMedia,
  onReorderPendingMedia,
  onOpenPendingActions,
  bottomRef,
}: {
  messages: AgentMessage[];
  pendingActions: PendingAction[];
  isThinking: boolean;
  isSending: boolean;
  onSend: (value: string) => void;
  onSlashCommand: (
    command: "rewrite" | "formal" | "summarize",
    text: string,
  ) => Promise<string>;
  onUpdatePendingPayload: (actionId: Id<"adminPendingActions">, payload: unknown) => Promise<void>;
  onConfirmPendingAction: (actionId: Id<"adminPendingActions">, payload?: unknown) => Promise<void>;
  onCancelPendingAction: (actionId: Id<"adminPendingActions">) => Promise<void>;
  onGenerateUploadUrl: (actionId: Id<"adminPendingActions">) => Promise<string>;
  onAttachPendingMedia: (
    actionId: Id<"adminPendingActions">,
    storageId: Id<"_storage">,
    kind: "image" | "logo",
  ) => Promise<void>;
  onRemovePendingMedia: (mediaId: Id<"entityMedia">) => Promise<void>;
  onReorderPendingMedia: (
    actionId: Id<"adminPendingActions">,
    mediaIds: Id<"entityMedia">[],
  ) => Promise<void>;
  onOpenPendingActions?: () => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef(0);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const updateNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(distance < 140);
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior, block: "end" });
      }
    },
    [bottomRef],
  );

  useEffect(() => {
    const firstLoad = lastMessageCountRef.current === 0 && messages.length > 0;
    const newMessage = messages.length > lastMessageCountRef.current;
    if (
      firstLoad ||
      (newMessage && isNearBottom) ||
      (isThinking && isNearBottom)
    ) {
      scrollToBottom(firstLoad ? "auto" : "smooth");
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, isThinking, isNearBottom, scrollToBottom]);

  const lastEngagement = [...messages]
    .reverse()
    .filter((msg) => msg.isAi)
    .map((msg) => parseAssistantPayload(msg.content))
    .find((payload) => payload?.type === "engagement");

  const handleSuggestedAction = useCallback(
    (action: { id: string; label: string; action: string; payload?: unknown }) => {
      const payloadText =
        action.payload == null
          ? ""
          : typeof action.payload === "string"
            ? action.payload
            : JSON.stringify(action.payload);
      onSend([action.action, payloadText].filter(Boolean).join("\n") || action.label);
    },
    [onSend],
  );

  const nextMissingField = lastEngagement?.type === "engagement"
    ? (lastEngagement.missingFields ?? []).find((field) => !field.value)
    : undefined;
  const goalHint = nextMissingField
    ? `المعلومة التالية المطلوبة: ${nextMissingField.label}`
    : lastEngagement?.type === "engagement"
      ? lastEngagement.conversationObjective
      : undefined;
  const statusLabel = isThinking ? "الوكيل يحلل الطلب ويجهز الرد" : "جاهز للإرسال";

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative">
      {/* Header - clean chat layout (Zola-inspired) */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot size={18} className="text-primary" />
            </div>
            <span className="font-semibold text-base">{ar.agentName}</span>
          </div>
        </div>
        <Separator />
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 md:px-0 scroll-smooth"
        ref={scrollRef}
        onScroll={updateNearBottom}
      >
        {messages.length === 0 ? (
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-10 p-6 animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-4 text-center max-w-xl">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot size={28} className="text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {ar.agentWelcomeDefault}
              </h1>
              <p className="text-sm text-muted-foreground">
                {ar.agentGreetingDefault}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSend(prompt)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-colors text-right"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground line-clamp-2">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto py-8 flex flex-col gap-6 pb-32">
            {lastEngagement?.type === "engagement" ? (
              <div className="rounded-xl border border-border bg-card/40 px-3 py-2">
                {lastEngagement.conversationObjective ? (
                  <p className="text-sm font-medium text-foreground">
                    {lastEngagement.conversationObjective}
                  </p>
                ) : null}
                {(lastEngagement.missingFields?.length ?? 0) > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lastEngagement.missingFields
                      ?.filter((field) => !field.value)
                      .map((field) => (
                        <Badge key={field.key} variant="outline" className="text-[11px]">
                          {field.label}
                        </Badge>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-8 pb-32">
              {messages.map((msg) =>
                msg.isAi ? (
                  <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <MessageBubbleAgent
                      content={msg.content}
                      status={msg.status}
                      onSuggestedAction={handleSuggestedAction}
                    />
                  </div>
                ) : (
                  <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <MessageBubbleHuman content={msg.content} />
                  </div>
                ),
              )}
              {pendingActions.length > 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-xl border border-border bg-card/30 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="text-xs font-medium text-foreground">
                      إجراءات تحتاج تأكيد داخل المحادثة
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {pendingActions.length} إجراء
                    </span>
                  </div>
                  <PendingActionPanel
                    actions={pendingActions}
                    updatePayload={onUpdatePendingPayload}
                    confirmAction={onConfirmPendingAction}
                    rewriteText={onSlashCommand}
                    cancelAction={onCancelPendingAction}
                    generateUploadUrl={onGenerateUploadUrl}
                    attachMedia={onAttachPendingMedia}
                    removeMedia={onRemovePendingMedia}
                    reorderMedia={onReorderPendingMedia}
                    compact
                    hideEmptyState
                  />
                </div>
              ) : null}
              {isThinking ? (
                <div className="flex gap-3 items-center px-4">
                  <ThinkingIndicator />
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>
        )}
      </div>

      {!isNearBottom && messages.length > 0 ? (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-10 h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </Button>
      ) : null}

      <div className="absolute bottom-6 left-0 right-0 px-4">
        <div className="max-w-3xl mx-auto">
          <Composer
            isLoading={isSending || isThinking}
            onSend={onSend}
            onSlashCommand={onSlashCommand}
            onOpenPendingActions={onOpenPendingActions}
            goalHint={goalHint}
            statusLabel={statusLabel}
          />
        </div>
      </div>
    </div>
  );
}
