"use client";

import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

const SLASH_COMMANDS = [
  {
    id: "rewrite",
    title: "/rewrite",
    description: "إعادة صياغة احترافية للنص العربي",
  },
  {
    id: "formal",
    title: "/formal",
    description: "تحويل النص لأسلوب رسمي ومهني",
  },
  {
    id: "summarize",
    title: "/summarize",
    description: "تلخيص النص بشكل واضح ومختصر",
  },
] as const;

type SlashCommand = (typeof SLASH_COMMANDS)[number]["id"];

export function Composer({
  isLoading,
  onSend,
  onSlashCommand,
}: {
  isLoading: boolean;
  onSend: (value: string) => void;
  onSlashCommand: (command: SlashCommand, text: string) => Promise<string>;
}) {
  const [input, setInput] = useState("");
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    const next = Math.min(textareaRef.current.scrollHeight, 220);
    textareaRef.current.style.height = `${next}px`;
  };

  const commandQuery = useMemo(() => {
    if (!input.startsWith("/")) return "";
    return input.slice(1).trim().toLowerCase();
  }, [input]);

  const isSlashPickerOpen = input.startsWith("/") && !input.includes(" ");
  const filteredCommands = useMemo(() => {
    if (!commandQuery) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((command) => command.id.includes(commandQuery));
  }, [commandQuery]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value || isLoading || isRunningCommand) return;

    if (value.startsWith("/")) {
      const [rawCommand, ...rest] = value.split(/\s+/);
      const command = rawCommand.slice(1).toLowerCase() as SlashCommand;
      const body = rest.join(" ").trim();
      const validCommand = SLASH_COMMANDS.some((item) => item.id === command);
      if (validCommand && body.length > 0) {
        try {
          setIsRunningCommand(true);
          const rewritten = await onSlashCommand(command, body);
          setInput(rewritten);
          if (textareaRef.current) {
            textareaRef.current.style.height = "44px";
          }
          requestAnimationFrame(() => resize());
        } finally {
          setIsRunningCommand(false);
        }
        return;
      }
    }

    onSend(value);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashPickerOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveCommandIndex((prev) =>
          prev === 0 ? filteredCommands.length - 1 : prev - 1
        );
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInput("");
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredCommands[activeCommandIndex] ?? filteredCommands[0];
        setInput(`/${selected.id} `);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const value = input.trim();
      if (!value || isLoading || isRunningCommand) return;
      void (async () => {
        if (value.startsWith("/")) {
          const [rawCommand, ...rest] = value.split(/\s+/);
          const command = rawCommand.slice(1).toLowerCase() as SlashCommand;
          const body = rest.join(" ").trim();
          const validCommand = SLASH_COMMANDS.some((item) => item.id === command);
          if (validCommand && body.length > 0) {
            try {
              setIsRunningCommand(true);
              const rewritten = await onSlashCommand(command, body);
              setInput(rewritten);
              if (textareaRef.current) {
                textareaRef.current.style.height = "44px";
              }
              requestAnimationFrame(() => resize());
            } finally {
              setIsRunningCommand(false);
            }
            return;
          }
        }
        onSend(value);
        setInput("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "44px";
        }
      })();
    }
  };

  return (
    <form className="agent-composer" dir="rtl" onSubmit={(e) => void submit(e)}>
      <div className="agent-composer-box">
        {isSlashPickerOpen && filteredCommands.length > 0 ? (
          <div className="agent-command-menu">
            {filteredCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                className={`agent-command-item ${index === activeCommandIndex ? "active" : ""}`}
                onClick={() => setInput(`/${command.id} `)}
              >
                <div className="agent-command-title">{command.title}</div>
                <div className="agent-command-description">{command.description}</div>
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          className="agent-textarea-input"
          placeholder="اكتب رسالتك هنا... أو اكتب / للأوامر"
          rows={1}
        />
        <div className="agent-composer-footer">
          <div className="agent-composer-hint">Enter للإرسال - Shift+Enter لسطر جديد</div>
          <button
            className="agent-send-btn"
            type="submit"
            disabled={!input.trim() || isLoading || isRunningCommand}
            aria-label="إرسال الرسالة"
          >
            {isLoading || isRunningCommand ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowUp size={16} />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
