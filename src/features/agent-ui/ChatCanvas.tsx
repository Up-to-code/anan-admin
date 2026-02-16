"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AgentMessage } from "./types";
import { MessageBubbleHuman } from "./MessageBubbleHuman";
import { MessageBubbleAgent } from "./MessageBubbleAgent";
import { Composer } from "./Composer";
import { SearchTracePanel, parseSearchTrace } from "./SearchTracePanel";

const STARTER_PROMPTS = [
  "أنشئ عقارا جديدا من هذا الوصف",
  "أضف بنكا جديدا مع البيانات الأساسية والشعار",
  "راجع الإجراءات المعلقة وأخبرني بما يحتاج تأكيد",
  "اقترح ثلاث عقارات مناسبة لعائلة في الرياض",
];

function SearchTracePanelWrapper({ content }: { content: string }) {
  const trace = parseSearchTrace(content);
  if (!trace) return null;
  return (
    <div className="px-4 pb-2">
      <SearchTracePanel trace={trace} />
    </div>
  );
}

export function ChatCanvas({
  messages,
  isThinking,
  isSending,
  onSend,
  onSlashCommand,
  bottomRef,
}: {
  messages: AgentMessage[];
  isThinking: boolean;
  isSending: boolean;
  onSend: (value: string) => void;
  onSlashCommand: (
    command: "rewrite" | "formal" | "summarize",
    text: string,
  ) => Promise<string>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef(0);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const updateNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(distance < 140);
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior, block: "end" });
      }
    },
    [bottomRef],
  );

  useEffect(() => {
    const firstLoad = lastMessageCountRef.current === 0 && messages.length > 0;
    const newMessage = messages.length > lastMessageCountRef.current;
    if (
      firstLoad ||
      (newMessage && isNearBottom) ||
      (isThinking && isNearBottom)
    ) {
      scrollToBottom(firstLoad ? "auto" : "smooth");
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, isThinking, isNearBottom, scrollToBottom]);

  return (
    <>
      <div
        className="agent-scroll agent-chat-scroll"
        ref={scrollRef}
        onScroll={updateNearBottom}
      >
        <div className="agent-chat-wrap">
          {messages.length === 0 ? (
            <div className="agent-empty-state">
              <div className="agent-empty-title">كيف أقدر أساعدك اليوم؟</div>
              <div className="agent-empty-subtitle">
                اطلب من الوكيل إنشاء كيانات جديدة أو تجهيز إجراءات أو تقديم
                توصيات.
              </div>
              <div className="agent-starter-grid">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className="agent-starter-btn"
                    onClick={() => onSend(prompt)}
                    disabled={isSending || isThinking}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="agent-message-list">
              {messages.map((msg) =>
                msg.isAi ? (
                  <div key={msg.id}>
                    <MessageBubbleAgent content={msg.content} />
                    {msg.content && (
                      <SearchTracePanelWrapper content={msg.content} />
                    )}
                  </div>
                ) : (
                  <MessageBubbleHuman key={msg.id} content={msg.content} />
                ),
              )}
              {isThinking ? (
                <div className="agent-bubble-row ai">
                  <span className="agent-avatar ai">
                    <Loader2 size={15} className="animate-spin" />
                  </span>
                  <div className="agent-bubble ai">جاري التفكير...</div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <div className="agent-composer-wrap">
        <Composer
          isLoading={isSending || isThinking}
          onSend={onSend}
          onSlashCommand={onSlashCommand}
        />
      </div>
    </>
  );
}
