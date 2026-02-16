"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({ content }: { content: string }) {
    return (
        <div className={cn(
            "prose prose-zinc dark:prose-invert max-w-none break-words",
            // Text & Spacing
            "text-foreground/90 leading-relaxed",
            "prose-p:m-0 prose-p:mb-2 last:prose-p:mb-0",
            "prose-headings:font-normal prose-headings:text-foreground prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
            "prose-strong:font-medium prose-strong:text-foreground",
            "prose-ul:m-0 prose-ul:mb-2 prose-ul:list-disc prose-ul:pl-4",
            "prose-ol:m-0 prose-ol:mb-2 prose-ol:list-decimal prose-ol:pl-4",
            "prose-li:m-0 prose-li:mb-0.5",

            // Links
            "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",

            // Code Blocks
            "prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:text-zinc-900 dark:prose-code:text-zinc-100 prose-code:before:content-none prose-code:after:content-none prose-code:font-mono prose-code:text-sm",
            "prose-pre:p-4 prose-pre:rounded-xl prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-900 prose-pre:text-zinc-900 dark:prose-pre:text-zinc-50 prose-pre:border prose-pre:border-zinc-200 dark:prose-pre:border-zinc-800",

            // Blockquotes
            "prose-blockquote:border-l-2 prose-blockquote:border-zinc-300 dark:prose-blockquote:border-zinc-700 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",

            // Tables
            "prose-th:text-left prose-th:p-2 prose-td:p-2 prose-tr:border-b prose-tr:border-border"
        )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
