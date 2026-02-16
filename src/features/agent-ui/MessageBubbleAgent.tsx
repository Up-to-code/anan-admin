"use client";

import { Bot } from "lucide-react";
import { parseAssistantPayload } from "./parseAssistantPayload";
import { StructuredCards } from "./StructuredCards";

export function MessageBubbleAgent({ content }: { content: string }) {
  const parsed = parseAssistantPayload(content);
  if (parsed && parsed.type !== "text") {
    return (
      <div className="agent-bubble-row ai">
        <span className="agent-avatar ai">
          <Bot size={15} />
        </span>
        <div className="agent-bubble ai" style={{ background: "transparent", padding: 0, maxWidth: "85%" }}>
          <StructuredCards payload={parsed} />
        </div>
      </div>
    );
  }

  return (
    <div className="agent-bubble-row ai">
      <span className="agent-avatar ai">
        <Bot size={15} />
      </span>
      <div className="agent-bubble ai">{parsed?.type === "text" ? parsed.text : content}</div>
    </div>
  );
}
