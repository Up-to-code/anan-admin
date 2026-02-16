"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={cn("flex gap-3", message.isAi ? "flex-row" : "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          message.isAi ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {message.isAi ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          message.isAi ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
      </div>
    </div>
  );
}
