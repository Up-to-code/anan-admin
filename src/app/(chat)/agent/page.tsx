"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "convex/_generated/api";
import { AgentShell } from "@/features/agent-ui/AgentShell";
import type {
  AgentMessage,
  AgentThread,
  PendingAction,
} from "@/features/agent-ui/types";

function useAdminMessages(threadId: string | null) {
  const args = threadId ? { threadId } : "skip";
  return useUIMessages(
    api.features.admin.agentActions.getAdminThreadMessages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args as any,
    { initialNumItems: 50, stream: true }
  );
}

export default function AgentPage() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSelectedInitialThread = useRef(false);

  const createThread = useMutation(api.features.admin.agentActions.createAdminThread);
  const sendMessage = useMutation(api.features.admin.agentActions.sendAdminMessage);
  const renameThread = useMutation(api.features.admin.agentActions.renameAdminThread);
  const deleteThread = useAction(api.features.admin.agentActions.deleteAdminThread);
  const rewriteAdminCopy = useAction(api.features.admin.agentActions.rewriteAdminCopy);
  const updatePendingPayload = useMutation(api.features.admin.agentActions.updatePendingActionPayload);
  const confirmPendingAction = useMutation(api.features.admin.agentActions.confirmPendingAction);
  const cancelPendingAction = useMutation(api.features.admin.agentActions.cancelPendingAction);
  const generateUploadUrl = useMutation(
    api.features.admin.agentActions.generatePendingActionUploadUrl
  );
  const attachPendingMedia = useMutation(api.features.admin.agentActions.attachPendingActionMedia);
  const removePendingMedia = useMutation(api.features.admin.agentActions.removePendingActionMedia);
  const reorderPendingMedia = useMutation(api.features.admin.agentActions.reorderPendingActionMedia);

  const messagesResult = useAdminMessages(threadId);
  const pendingActions = useQuery(
    api.features.admin.agentActions.listPendingActions,
    threadId ? { threadId } : "skip"
  ) as PendingAction[] | undefined;

  const threadsResult = useQuery(api.features.admin.agentActions.listAdminThreads, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const threads = (threadsResult?.page ?? []) as AgentThread[];

  const rawMessages = (messagesResult?.results ?? []) as Array<{
    role?: string;
    key: string;
    text: string;
  }>;

  const chatMessages: AgentMessage[] = useMemo(() => {
    return rawMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.key,
        content: m.text || "",
        isAi: m.role === "assistant",
      }));
  }, [rawMessages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  }, []);

  useEffect(() => {
    if (chatMessages.length > 0) {
      const timer = setTimeout(() => scrollToBottom("smooth"), 100);
      return () => clearTimeout(timer);
    }
  }, [chatMessages.length, scrollToBottom]);

  useEffect(() => {
    if (chatMessages.length > 0 && isThinking) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage.isAi && lastMessage.content) {
        setIsThinking(false);
      }
    }
  }, [chatMessages, isThinking]);

  useEffect(() => {
    if (hasSelectedInitialThread.current) return;
    if (threads.length === 0) return;
    if (!threadId) {
      setThreadId(threads[0]._id);
    }
    hasSelectedInitialThread.current = true;
  }, [threads, threadId]);

  const handleSend = async (userMessage: string) => {
    setIsSending(true);
    setIsThinking(true);

    try {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        const result = await createThread({
          title: userMessage.substring(0, 50),
        });
        currentThreadId = result.threadId;
        setThreadId(currentThreadId);
      }

      await sendMessage({
        threadId: currentThreadId,
        body: userMessage,
      });
    } catch (error) {
      console.error("Send error:", error);
      setIsThinking(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleNewChat = async () => {
    if (isSending || isThinking || isCreatingThread) return;
    try {
      setIsCreatingThread(true);
      const result = await createThread({ title: "محادثة جديدة" });
      setThreadId(result.threadId);
      setIsThinking(false);
    } catch (error) {
      console.error("Create thread error:", error);
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleSelectThread = (targetThreadId: string) => {
    setThreadId(targetThreadId);
    setIsThinking(false);
  };

  const handleDeleteThread = async (targetThreadId: string) => {
    try {
      setDeletingThreadId(targetThreadId);
      await deleteThread({ threadId: targetThreadId });
      if (threadId === targetThreadId) {
        const remaining = threads.filter((thread) => thread._id !== targetThreadId);
        setThreadId(remaining[0]?._id ?? null);
        setIsThinking(false);
      }
    } catch (error) {
      console.error("Delete thread error:", error);
    } finally {
      setDeletingThreadId(null);
    }
  };

  return (
    <AgentShell
      threads={threads}
      activeThreadId={threadId}
      messages={chatMessages}
      pendingActions={pendingActions ?? []}
      isThreadsLoading={threadsResult === undefined}
      isSending={isSending || isCreatingThread}
      isThinking={isThinking}
      deletingThreadId={deletingThreadId}
      onNewThread={() => void handleNewChat()}
      onSelectThread={handleSelectThread}
      onDeleteThread={(id) => void handleDeleteThread(id)}
      onRenameThread={(id, title) => renameThread({ threadId: id, title })}
      onSendMessage={handleSend}
      onSlashCommand={async (command, text) => {
        const response = await rewriteAdminCopy({ mode: command, text });
        return response.text;
      }}
      onRewriteText={async (mode, text) => {
        const response = await rewriteAdminCopy({ mode, text });
        return response.text;
      }}
      onUpdatePendingPayload={async (actionId, payload) => {
        await updatePendingPayload({ actionId, payload });
      }}
      onConfirmPendingAction={async (actionId, payload) => {
        await confirmPendingAction({ actionId, editedPayload: payload });
      }}
      onCancelPendingAction={async (actionId) => {
        await cancelPendingAction({ actionId });
      }}
      onGenerateUploadUrl={async (actionId) => {
        return generateUploadUrl({ actionId });
      }}
      onAttachPendingMedia={async (actionId, storageId, kind) => {
        await attachPendingMedia({ actionId, storageId, kind });
      }}
      onRemovePendingMedia={async (mediaId) => {
        await removePendingMedia({ mediaId });
      }}
      onReorderPendingMedia={async (actionId, mediaIds) => {
        await reorderPendingMedia({ actionId, mediaIds });
      }}
      bottomRef={messagesEndRef}
    />
  );
}
