"use client";

import { useMemo, useState } from "react";
import { ar } from "@/lib/ar";
import { Check, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import type { AgentThread } from "./types";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("ar-SA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getBucketLabel(
  timestamp: number
): typeof ar.today | typeof ar.thisWeek | typeof ar.older {
  const now = new Date();
  const target = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTargetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  const dayDiff = Math.floor((startOfToday - startOfTargetDay) / (1000 * 60 * 60 * 24));
  if (dayDiff <= 0) return ar.today;
  if (dayDiff <= 7) return ar.thisWeek;
  return ar.older;
}

export function ConversationRail({
  threads,
  activeThreadId,
  isLoading,
  isBusy,
  deletingThreadId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  onThreadChosen,
}: {
  threads: AgentThread[];
  activeThreadId: string | null;
  isLoading: boolean;
  isBusy: boolean;
  deletingThreadId: string | null;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => Promise<unknown>;
  onThreadChosen?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const groupedThreads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = !normalized
      ? threads
      : threads.filter((thread) =>
      (thread.title ?? ar.newChat).toLowerCase().includes(normalized)
    );
    const groups: Record<string, AgentThread[]> = {
      [ar.today]: [],
      [ar.thisWeek]: [],
      [ar.older]: [],
    };
    for (const thread of filtered) {
      groups[getBucketLabel(thread._creationTime)].push(thread);
    }
    return groups;
  }, [threads, query]);

  return (
    <div dir="rtl" className="agent-rail-rtl">
      <div className="agent-rail-header">
        <button
          className="agent-btn primary"
          style={{ width: "100%", justifyContent: "flex-start" }}
          onClick={() => {
            onNewThread();
            onThreadChosen?.();
          }}
          disabled={isBusy}
        >
          <Plus size={15} />
          {ar.newChat}
        </button>
      </div>

      <div className="agent-rail-section">
        <div className="agent-section-label">{ar.conversations}</div>
        <div className="agent-inline-row">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="agent-search"
            placeholder={ar.searchSessions}
          />
        </div>
      </div>

      <div className="agent-scroll agent-rail-section" style={{ paddingTop: 0 }}>
        <div className="agent-thread-list">
          {isLoading ? (
            <>
              <div className="agent-thread-item">{ar.loadingSessions}</div>
              <div className="agent-thread-item">{ar.loadingSessions}</div>
            </>
          ) : Object.values(groupedThreads).every((group) => group.length === 0) ? (
            <div className="agent-thread-item">{ar.noSessionsYet}</div>
          ) : (
            ([ar.today, ar.thisWeek, ar.older] as const).map((bucket) =>
              groupedThreads[bucket].length > 0 ? (
                <div key={bucket} className="agent-thread-group">
                  <div className="agent-section-label">{bucket}</div>
                  {groupedThreads[bucket].map((thread) => {
                    const isActive = thread._id === activeThreadId;
                    const isEditing = thread._id === editingThreadId;

                    return (
                      <div
                        key={thread._id}
                        className={`agent-thread-item ${isActive ? "active" : ""}`}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          {isEditing ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <input
                                className="agent-rename-input"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void onRenameThread(thread._id, editingTitle.trim()).then(() => {
                                      setEditingThreadId(null);
                                      setEditingTitle("");
                                    });
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    setEditingThreadId(null);
                                    setEditingTitle("");
                                  }
                                }}
                              />
                              <div className="agent-inline-row">
                                <button
                                  className="agent-btn icon ghost"
                                  onClick={() =>
                                    void onRenameThread(thread._id, editingTitle.trim()).then(() => {
                                      setEditingThreadId(null);
                                      setEditingTitle("");
                                    })
                                  }
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  className="agent-btn icon ghost"
                                  onClick={() => {
                                    setEditingThreadId(null);
                                    setEditingTitle("");
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="agent-thread-main"
                              onClick={() => {
                                onSelectThread(thread._id);
                                onThreadChosen?.();
                              }}
                            >
                              <div className="agent-thread-title">{thread.title?.trim() || ar.newChat}</div>
                              <div className="agent-thread-meta">{formatDate(thread._creationTime)}</div>
                            </button>
                          )}
                        </div>

                        {!isEditing ? (
                          <div className="agent-thread-actions">
                            <button
                              className="agent-btn icon ghost"
                              onClick={() => {
                                setEditingThreadId(thread._id);
                                setEditingTitle(thread.title?.trim() || "");
                              }}
                              aria-label={ar.editTitle}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="agent-btn icon ghost"
                              disabled={deletingThreadId === thread._id}
                              onClick={() => onDeleteThread(thread._id)}
                              aria-label={ar.deleteConversation}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null
            )
          )}
        </div>
      </div>
    </div>
  );
}
