"use client";

import { AgentShell } from "@/features/agent-ui/AgentShell";
import { AgentChatErrorBoundary } from "@/features/agent-ui/AgentChatErrorBoundary";
import { useAgentChat } from "@/features/agent-ui/useAgentChat";

export default function AgentPage() {
  const {
    threads,
    threadId,
    chatMessages,
    pendingActions,
    isThreadsLoading,
    isSending,
    isThinking,
    deletingThreadId,
    messagesEndRef,
    handleSend,
    handleNewChat,
    handleSelectThread,
    handleDeleteThread,
    handleRenameThread,
    handleSlashCommand,
    updatePendingPayload,
    confirmPendingAction,
    cancelPendingAction,
    generateUploadUrl,
    attachPendingMedia,
    removePendingMedia,
    reorderPendingMedia,
  } = useAgentChat();

  return (
    <AgentChatErrorBoundary>
      <AgentShell
        threads={threads}
        activeThreadId={threadId}
        messages={chatMessages}
        pendingActions={pendingActions}
        isThreadsLoading={isThreadsLoading}
        isSending={isSending}
        isThinking={isThinking}
        deletingThreadId={deletingThreadId}
        onNewThread={() => void handleNewChat()}
        onSelectThread={handleSelectThread}
        onDeleteThread={(id) => void handleDeleteThread(id)}
        onRenameThread={handleRenameThread}
        onSendMessage={handleSend}
        onSlashCommand={handleSlashCommand}
        onRewriteText={handleSlashCommand}
        onUpdatePendingPayload={async (actionId, payload) => {
          await updatePendingPayload({ actionId, payload });
        }}
        onConfirmPendingAction={async (actionId, payload) => {
          await confirmPendingAction({ actionId, editedPayload: payload });
        }}
        onCancelPendingAction={async (actionId) => {
          await cancelPendingAction({ actionId });
        }}
        onGenerateUploadUrl={async (actionId) => generateUploadUrl({ actionId })}
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
    </AgentChatErrorBoundary>
  );
}
