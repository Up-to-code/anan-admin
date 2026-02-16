"use client";

import { Bot, Loader2 } from "lucide-react";
import { ar } from "@/lib/ar";

export function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl bg-muted px-4 py-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">{ar.agentThinking}</span>
        </div>
      </div>
    </div>
  );
}
