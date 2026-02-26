"use client";

import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Paperclip } from "lucide-react";
import { ar } from "@/lib/ar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  onOpenPendingActions,
  goalHint,
  statusLabel,
}: {
  isLoading: boolean;
  onSend: (value: string) => void;
  onSlashCommand: (command: SlashCommand, text: string) => Promise<string>;
  onOpenPendingActions?: () => void;
  goalHint?: string;
  statusLabel?: string;
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
            requestAnimationFrame(() => {
              resize();
              textareaRef.current?.focus();
            });
          }
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
    requestAnimationFrame(() => textareaRef.current?.focus());
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
          requestAnimationFrame(() => textareaRef.current?.focus());
        }
      })();
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <form className="w-full" dir="rtl" onSubmit={(e) => void submit(e)}>
        {goalHint ? (
          <div className="mb-2 px-1 text-xs text-muted-foreground">{goalHint}</div>
        ) : null}
        <div className="relative flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2 shadow-sm transition-[box-shadow,border-color] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => onOpenPendingActions?.()}
            >
              <Paperclip size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{ar.agentPendingActionsLabel}</TooltipContent>
        </Tooltip>

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          placeholder={ar.agentPlaceholder}
          rows={1}
          disabled={isLoading || isRunningCommand}
          className="min-h-[44px] max-h-[220px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {isSlashPickerOpen && filteredCommands.length > 0 ? (
          <div className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-border bg-popover p-1 shadow-lg z-10">
            {filteredCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-right text-sm transition-colors flex flex-col items-start gap-0.5",
                  index === activeCommandIndex ? "bg-accent text-foreground" : "hover:bg-accent/50 text-muted-foreground"
                )}
                onMouseEnter={() => setActiveCommandIndex(index)}
                onClick={() => setInput(`/${command.id} `)}
              >
                <span className="font-medium">{command.title}</span>
                <span className="text-xs text-muted-foreground">{command.description}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-full transition-colors",
                  input.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground"
                )}
                disabled={!input.trim() || isLoading || isRunningCommand}
              >
                {isLoading || isRunningCommand ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowUp size={16} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{ar.agentSend}</TooltipContent>
          </Tooltip>
        </div>
        </div>
        <p aria-live="polite" className="sr-only">
          {statusLabel ?? (isLoading ? "جاري تحضير الرد" : "جاهز للإرسال")}
        </p>
    </form>
    </TooltipProvider>
  );
}
