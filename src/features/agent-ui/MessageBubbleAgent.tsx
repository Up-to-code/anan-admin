"use client";

import { Bot } from "lucide-react";
import { useSmoothText } from "@convex-dev/agent/react";
import { parseAssistantPayload } from "./parseAssistantPayload";
import { StructuredCards } from "./StructuredCards";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";

export function MessageBubbleAgent({
  content,
  status,
}: {
  content: string;
  status?: "streaming" | "finished" | "aborted";
}) {
  const [visibleText] = useSmoothText(content, {
    startStreaming: status === "streaming",
  });

  const isStreaming = status === "streaming";
  const parsed = !isStreaming ? parseAssistantPayload(content) : null;

  if (parsed && parsed.type !== "text") {
    return (
      <div className="flex gap-3 items-start max-w-full">
        <Avatar className="h-8 w-8 mt-1 border border-border shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <Bot size={15} />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 overflow-hidden break-words" style={{ maxWidth: "85%" }}>
          <StructuredCards payload={parsed} />
        </div>
      </div>
    );
  }

  const displayText = visibleText || (isStreaming ? "..." : content);

  return (
    <div className="flex gap-4 items-start w-full group">
      <Avatar className="h-8 w-8 mt-1 border-0 bg-transparent shrink-0">
        <AvatarFallback className="bg-transparent text-muted-foreground/50 group-hover:text-foreground/80 transition-colors">
          <Bot size={20} />
        </AvatarFallback>
      </Avatar>
      <div className={cn(
        "flex-1 min-w-0 break-words transition-opacity duration-200",
        isStreaming && "opacity-90",
        // Ensure no weird margins on top level
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      )}>
        <Markdown content={displayText} />
      </div>
    </div>
  );
}
