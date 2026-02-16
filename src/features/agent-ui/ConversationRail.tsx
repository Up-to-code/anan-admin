"use client";

import { useMemo, useState } from "react";
import { ar } from "@/lib/ar";
import { Bot, Check, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  timestamp: number
): typeof ar.today | typeof ar.last7Days | typeof ar.older {
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
  if (dayDiff <= 7) return ar.last7Days;
  return ar.older;
}

function AgentRailUserFooter() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? ar.admin;
  const image = session?.user?.image;

  return (
    <div className="flex items-center gap-3 p-3 mt-auto border-t border-white/10 bg-black/50 text-white">
      <Avatar className="h-8 w-8 border border-white/10">
        <AvatarImage src={image ?? undefined} />
        <AvatarFallback className="bg-zinc-800 text-white">{(name ?? "A").charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col overflow-hidden">
        <span className="text-sm font-medium truncate text-zinc-200">{name}</span>
        <span className="text-xs text-zinc-500">{ar.admin}</span>
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
        (thread.title ?? ar.newChat).toLowerCase().includes(normalized)
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
    <div dir="rtl" className="flex flex-1 flex-col min-h-0 overflow-hidden text-zinc-100">
      <div className="p-3">
        <Button
          className="w-full justify-start gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-white border-0"
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

      <div className="px-3 pb-2 relative">
        <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 pr-9 pl-2 text-sm bg-zinc-900/50 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-zinc-700"
          placeholder={ar.searchSessions}
        />
      </div>

      <ScrollArea className="flex-1 min-h-0 px-3">
        <div className="space-y-6 pb-4">
          <div className="text-xs font-semibold text-zinc-500 mb-2 mt-2">{ar.conversations}</div>

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-9 bg-zinc-800/20 rounded-md animate-pulse" />
              <div className="h-9 bg-zinc-800/20 rounded-md animate-pulse" />
            </div>
          ) : Object.values(groupedThreads).every((group) => group.length === 0) ? (
            <div className="text-center text-sm text-zinc-500 py-8">{ar.noSessionsYet}</div>
          ) : (
            ([ar.today, ar.last7Days, ar.older] as const).map((bucket) =>
              groupedThreads[bucket].length > 0 ? (
                <div key={bucket} className="space-y-1">
                  <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider px-2 py-1">{bucket}</div>
                  {groupedThreads[bucket].map((thread) => {
                    const isActive = thread._id === activeThreadId;
                    const isEditing = thread._id === editingThreadId;

                    return (
                      <div
                        key={thread._id}
                        className={cn(
                          "group relative flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-zinc-800/50",
                          isActive && "bg-zinc-800 font-medium text-white"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                className="h-7 text-xs px-2 bg-zinc-900 border-zinc-700"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                autoFocus
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-zinc-700"
                                onClick={() =>
                                  void onRenameThread(thread._id, editingTitle.trim()).then(() => {
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
                                className="h-7 w-7 hover:bg-zinc-700"
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
                              <div className="truncate text-sm text-zinc-300 group-hover:text-white transition-colors">{thread.title?.trim() || ar.newChat}</div>
                              <div className="truncate text-xs text-zinc-600">{formatDate(thread._creationTime)}</div>
                            </button>
                          )}
                        </div>

                        {!isEditing && (
                          <div className={cn("hidden items-center gap-0.5 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100 focus-within:opacity-100", isActive && "flex opacity-100")}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-zinc-500 hover:text-white hover:bg-zinc-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingThreadId(thread._id);
                                setEditingTitle(thread.title?.trim() || "");
                              }}
                            >
                              <Edit3 size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-zinc-900/50"
                              disabled={deletingThreadId === thread._id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteThread(thread._id);
                              }}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null
            )
          )}
        </div>
      </ScrollArea>

      <AgentRailUserFooter />
    </div>
  );
}
