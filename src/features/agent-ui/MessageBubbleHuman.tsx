"use client";

import { User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function MessageBubbleHuman({ content }: { content: string }) {
  return (
    <div className="flex flex-row-reverse gap-3 items-start">
      <div className="max-w-[80%] rounded-[24px] px-5 py-3 text-base leading-relaxed bg-[#F4F4F5] text-zinc-900 dark:bg-[#27272A] dark:text-[#FAFAFA] shadow-sm">
        {content}
      </div>
    </div>
  );
}
