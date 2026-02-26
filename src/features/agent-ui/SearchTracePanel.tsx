"use client";

import {
  ExternalLink,
  Clock,
  Image,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { ar } from "@/lib/ar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SearchTraceSource {
  url: string;
  title?: string;
  duration?: number;
  cardsExtracted?: number;
  imagesFound?: number;
  status: "success" | "partial" | "failed";
  error?: string;
}

interface SearchTraceData {
  query: string;
  sources: SearchTraceSource[];
  totalDuration: number;
  totalResults: number;
  cachedFrom?: string;
}

interface SearchTracePanelProps {
  trace: SearchTraceData;
}

export function SearchTracePanel({ trace }: SearchTracePanelProps) {
  return (
    <div className="border border-border rounded-lg bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{ar.searchSources}</h3>
          <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border">«{trace.query}»</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {(trace.totalDuration / 1000).toFixed(1)}s
          </span>
          {trace.cachedFrom && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle size={12} />
              <span>{ar.cachedFrom} {trace.cachedFrom}</span>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {trace.sources.map((source, idx) => (
          <div key={idx} className="p-3 text-sm hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-start gap-2 min-w-0">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground shrink-0 mt-0.5">{idx + 1}</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline truncate block"
                >
                  {source.title || truncateUrl(source.url)}
                  <ExternalLink size={10} className="inline-block mr-1 opacity-50" />
                </a>
              </div>
              <div className="shrink-0">
                {source.status === "success" && <CheckCircle size={14} className="text-green-500" />}
                {source.status === "partial" && <AlertCircle size={14} className="text-yellow-500" />}
                {source.status === "failed" && <AlertCircle size={14} className="text-red-500" />}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground pr-7">
              {source.duration && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {(source.duration / 1000).toFixed(1)}s
                </span>
              )}
              {source.cardsExtracted !== undefined && (
                <span className="flex items-center gap-1">
                  📋 {source.cardsExtracted} cards
                </span>
              )}
              {source.imagesFound !== undefined && source.imagesFound > 0 && (
                <span className="flex items-center gap-1">
                  <Image size={10} />
                  {source.imagesFound} images
                </span>
              )}
            </div>

            {source.error && (
              <div className="mt-2 text-xs text-destructive flex items-center gap-1 pr-7">
                <AlertCircle size={12} />
                {source.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-border bg-muted/20 text-xs text-muted-foreground text-center">
        <span className="font-medium text-foreground">
          {trace.totalResults}
        </span> {ar.resultsFound}
      </div>
    </div>
  );
}

function truncateUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.slice(0, 30);
    return `${urlObj.hostname}${path}${urlObj.pathname.length > 30 ? "..." : ""}`;
  } catch {
    return url.slice(0, 40);
  }
}

export function parseSearchTrace(content: string): SearchTraceData | null {
  try {
    const toolMatch = content.match(
      /tool-smartPropertySearch[^}]*"output":\s*"([^"]+)"/,
    );
    if (!toolMatch) return null;

    const decoded = decodeURIComponent(toolMatch[1]);
    const data = JSON.parse(decoded);

    const sources: SearchTraceSource[] = [];

    if (data.knowledgeResearch?.sourceRuns) {
      for (const run of data.knowledgeResearch.sourceRuns) {
        sources.push({
          url: run.url,
          title: run.title,
          cardsExtracted: run.cardsExtracted,
          status: "success",
        });
      }
    }

    return {
      query: data.searchTerms?.[0] || "",
      sources,
      totalDuration: 0,
      totalResults: data.results?.length || 0,
    };
  } catch {
    return null;
  }
}
