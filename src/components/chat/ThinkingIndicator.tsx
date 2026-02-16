"use client";

import { Bot } from "lucide-react";
import { ar } from "@/lib/ar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function ThinkingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 items-center", className)}>
      <Avatar className="h-8 w-8 mt-1 border border-zinc-200 dark:border-zinc-800 shrink-0">
        <AvatarFallback className="bg-transparent text-zinc-400">
          <Bot size={15} />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full animate-bounce" />
      </div>
    </div>
  );
}
