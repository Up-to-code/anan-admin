"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { toast } from "sonner";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import type {
  AdminTaskRequest,
  AgentMessage,
  AgentThread,
  PendingAction,
} from "./types";

function useAdminMessages(threadId: string | null) {
  const args: { threadId: string } | "skip" = threadId ? { threadId } : "skip";
  return useUIMessages(
    api.features.admin.agentActions.getAdminThreadMessages,
    args,
    { initialNumItems: 50, stream: true }
  );
}

export function useAgentChat() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSelectedInitialThread = useRef(false);

  const isAdmin = useQuery(api.features.admin.api.isAdmin);

  const createThread = useMutation(api.features.admin.agentActions.createAdminThread);
  const sendMessage = useMutation(api.features.admin.agentActions.sendAdminMessage);
  const sendTaskRequest = useMutation(api.features.admin.agentActions.sendAdminTaskRequest);
  const renameThread = useMutation(api.features.admin.agentActions.renameAdminThread);
  const deleteThread = useMutation(api.features.admin.agentActions.deleteAdminThread);
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

  const messagesResult = useAdminMessages(isAdmin === true ? threadId : null);
  const pendingActions = useQuery(
    api.features.admin.agentActions.listPendingActions,
    isAdmin === true && threadId ? { threadId } : "skip"
  ) as PendingAction[] | undefined;

  const threadsResult = useQuery(
    api.features.admin.agentActions.listAdminThreads,
    isAdmin === true ? { paginationOpts: { numItems: 50, cursor: null } } : "skip"
  );
  const threads = (threadsResult?.page ?? []) as AgentThread[];

  const rawMessages = (messagesResult?.results ?? []) as Array<{
    role?: string;
    key: string;
    text: string;
    status?: "streaming" | "finished" | "aborted";
    parts?: unknown[];
  }>;

  const chatMessages: AgentMessage[] = useMemo(() => {
    return rawMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.key,
        content: m.text || "",
        isAi: m.role === "assistant",
        status: m.status,
        parts: m.parts,
      }));
  }, [rawMessages]);

  const isThinking = useMemo(
    () => chatMessages.some((m) => m.isAi && m.status === "streaming"),
    [chatMessages]
  );

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
    if (hasSelectedInitialThread.current) return;
    if (threads.length === 0) return;
    if (!threadId) {
      setThreadId(threads[0]._id);
    }
    hasSelectedInitialThread.current = true;
  }, [threads, threadId]);

  const handleSend = useCallback(
    async (userMessage: string) => {
      setIsSending(true);

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
        toast.error(ar.sendFailed);
      } finally {
        setIsSending(false);
      }
    },
    [threadId, createThread, sendMessage]
  );

  const handleNewChat = useCallback(async () => {
    if (isSending || isThinking || isCreatingThread) return;
    try {
      setIsCreatingThread(true);
      const result = await createThread({ title: "محادثة جديدة" });
      setThreadId(result.threadId);
    } catch (error) {
      console.error("Create thread error:", error);
      toast.error(ar.createThreadFailed);
    } finally {
      setIsCreatingThread(false);
    }
  }, [isSending, isThinking, isCreatingThread, createThread]);

  const handleSendTask = useCallback(
    async (task: AdminTaskRequest) => {
      if (!task.goal.trim()) return;
      setIsSending(true);
      try {
        const result = await sendTaskRequest({
          ...task,
          threadId: threadId ?? task.threadId,
        });
        if (!threadId || threadId !== result.threadId) {
          setThreadId(result.threadId);
        }
      } catch (error) {
        console.error("Send task error:", error);
        toast.error(ar.sendFailed);
      } finally {
        setIsSending(false);
      }
    },
    [sendTaskRequest, threadId]
  );

  const handleSelectThread = useCallback((targetThreadId: string) => {
    setThreadId(targetThreadId);
  }, []);

  const handleDeleteThread = useCallback(
    async (targetThreadId: string) => {
      try {
        setDeletingThreadId(targetThreadId);
        await deleteThread({ threadId: targetThreadId });
        if (threadId === targetThreadId) {
          const remaining = threads.filter((thread) => thread._id !== targetThreadId);
          setThreadId(remaining[0]?._id ?? null);
        }
      } catch (error) {
        console.error("Delete thread error:", error);
        toast.error(ar.deleteThreadFailed);
      } finally {
        setDeletingThreadId(null);
      }
    },
    [threadId, threads, deleteThread]
  );

  const handleRenameThread = useCallback(
    (id: string, title: string) => renameThread({ threadId: id, title }),
    [renameThread]
  );

  const handleSlashCommand = useCallback(
    async (command: "rewrite" | "formal" | "summarize", text: string) => {
      const response = await rewriteAdminCopy({ mode: command, text });
      return response.text;
    },
    [rewriteAdminCopy]
  );

  return {
    threads,
    threadId,
    chatMessages,
    pendingActions: pendingActions ?? [],
    isThreadsLoading: threadsResult === undefined,
    isSending: isSending || isCreatingThread,
    isThinking,
    deletingThreadId,
    messagesEndRef,
    handleSend,
    handleSendTask,
    handleNewChat,
    handleSelectThread,
    handleDeleteThread,
    handleRenameThread,
    handleSlashCommand,
    createThread,
    updatePendingPayload,
    confirmPendingAction,
    cancelPendingAction,
    generateUploadUrl,
    attachPendingMedia,
    removePendingMedia,
    reorderPendingMedia,
  };
}
