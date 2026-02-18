"use client";

import { useMemo, useState } from "react";
import { ar } from "@/lib/ar";
import { Check, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AgentThread } from "./types";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("ar-SA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getBucketLabel(
  timestamp: number,
): typeof ar.today | typeof ar.last7Days | typeof ar.older {
  const now = new Date();
  const target = new Date(timestamp);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfTargetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  const dayDiff = Math.floor(
    (startOfToday - startOfTargetDay) / (1000 * 60 * 60 * 24),
  );
  if (dayDiff <= 0) return ar.today;
  if (dayDiff <= 7) return ar.last7Days;
  return ar.older;
}

function AgentRailUserFooter() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? ar.admin;
  const image = session?.user?.image;

  return (
    <div className="mt-auto flex items-center gap-3 border-t border-border bg-card/30 p-3">
      <Avatar className="h-8 w-8 border border-border/60">
        <AvatarImage src={image ?? undefined} />
        <AvatarFallback className="bg-muted text-foreground">
          {(name ?? "A").charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col overflow-hidden">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">{ar.admin}</span>
      </div>
    </div>
  );
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
          (thread.title ?? ar.newChat).toLowerCase().includes(normalized),
        );
    const groups: Record<string, AgentThread[]> = {
      [ar.today]: [],
      [ar.last7Days]: [],
      [ar.older]: [],
    };
    for (const thread of filtered) {
      groups[getBucketLabel(thread._creationTime)].push(thread);
    }
    return groups;
  }, [threads, query]);

  return (
    <div dir="rtl" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="p-3">
        <Button
          className="h-9 w-full justify-start gap-2"
          onClick={() => {
            onNewThread();
            onThreadChosen?.();
          }}
          disabled={isBusy}
        >
          <Plus size={16} />
          {ar.newChat}
        </Button>
      </div>

      <div className="relative px-3 pb-2">
        <Search
          className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={14}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 pl-2 pr-9 text-sm"
          placeholder={ar.searchSessions}
        />
      </div>

      <ScrollArea className="flex-1 min-h-0 px-3">
        <div className="space-y-6 pb-4">
          <div className="mb-2 mt-2 text-xs font-semibold text-muted-foreground">
            {ar.conversations}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-9 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
          ) : Object.values(groupedThreads).every((group) => group.length === 0) ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {ar.noSessionsYet}
            </div>
          ) : (
            ([ar.today, ar.last7Days, ar.older] as const).map((bucket) =>
              groupedThreads[bucket].length > 0 ? (
                <div key={bucket} className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {bucket}
                  </div>
                  {groupedThreads[bucket].map((thread) => {
                    const isActive = thread._id === activeThreadId;
                    const isEditing = thread._id === editingThreadId;

                    return (
                      <div
                        key={thread._id}
                        className={cn(
                          "group relative flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                          "hover:bg-accent/60",
                          isActive && "bg-accent font-medium text-foreground",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                className="h-7 px-2 text-xs"
                                value={editingTitle}
                                onChange={(event) =>
                                  setEditingTitle(event.target.value)
                                }
                                autoFocus
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void onRenameThread(
                                      thread._id,
                                      editingTitle.trim(),
                                    ).then(() => {
                                      setEditingThreadId(null);
                                      setEditingTitle("");
                                    });
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    setEditingThreadId(null);
                                    setEditingTitle("");
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  void onRenameThread(
                                    thread._id,
                                    editingTitle.trim(),
                                  ).then(() => {
                                    setEditingThreadId(null);
                                    setEditingTitle("");
                                  })
                                }
                              >
                                <Check size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingThreadId(null);
                                  setEditingTitle("");
                                }}
                              >
                                <X size={12} />
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="w-full text-right outline-none"
                              onClick={() => {
                                onSelectThread(thread._id);
                                onThreadChosen?.();
                              }}
                            >
                              <div className="truncate text-sm text-foreground">
                                {thread.title?.trim() || ar.newChat}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {formatDate(thread._creationTime)}
                              </div>
                            </button>
                          )}
                        </div>

                        {!isEditing ? (
                          <div
                            className={cn(
                              "hidden items-center gap-0.5 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100 focus-within:opacity-100",
                              isActive && "flex opacity-100",
                            )}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingThreadId(thread._id);
                                setEditingTitle(thread.title?.trim() || "");
                              }}
                            >
                              <Edit3 size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              disabled={deletingThreadId === thread._id}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteThread(thread._id);
                              }}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null,
            )
          )}
        </div>
      </ScrollArea>

      <AgentRailUserFooter />
    </div>
  );
}
