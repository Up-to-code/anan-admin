"use client";

import { User } from "lucide-react";

export function MessageBubbleHuman({ content }: { content: string }) {
  return (
    <div className="agent-bubble-row human">
      <span className="agent-avatar human">
        <User size={15} />
      </span>
      <div className="agent-bubble human">{content}</div>
    </div>
  );
}
