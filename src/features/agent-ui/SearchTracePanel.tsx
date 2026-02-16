"use client";

import {
  ExternalLink,
  Clock,
  Image,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

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
    <div className="search-trace-panel">
      <div className="search-trace-header">
        <h3 className="search-trace-title">Search Trace</h3>
        <div className="search-trace-meta">
          <span className="search-trace-query">"{trace.query}"</span>
          <span className="search-trace-duration">
            <Clock size={12} />
            {(trace.totalDuration / 1000).toFixed(1)}s
          </span>
        </div>
        {trace.cachedFrom && (
          <div className="search-trace-cached">
            <CheckCircle size={12} className="text-green-500" />
            <span>Cached from {trace.cachedFrom}</span>
          </div>
        )}
      </div>

      <div className="search-trace-sources">
        {trace.sources.map((source, idx) => (
          <div key={idx} className="search-trace-source">
            <div className="source-header">
              <span className="source-number">{idx + 1}</span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-url"
              >
                {source.title || truncateUrl(source.url)}
                <ExternalLink size={10} />
              </a>
              <span className={`source-status status-${source.status}`}>
                {source.status === "success" && <CheckCircle size={12} />}
                {source.status === "partial" && <AlertCircle size={12} />}
                {source.status === "failed" && (
                  <AlertCircle size={12} className="text-red-500" />
                )}
              </span>
            </div>

            <div className="source-stats">
              {source.duration && (
                <span className="source-stat">
                  <Clock size={10} />
                  {(source.duration / 1000).toFixed(1)}s
                </span>
              )}
              {source.cardsExtracted !== undefined && (
                <span className="source-stat">
                  📋 {source.cardsExtracted} cards
                </span>
              )}
              {source.imagesFound !== undefined && source.imagesFound > 0 && (
                <span className="source-stat">
                  <Image size={10} />
                  {source.imagesFound} images
                </span>
              )}
            </div>

            {source.error && (
              <div className="source-error">
                <AlertCircle size={12} />
                {source.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="search-trace-footer">
        <span className="total-results">
          {trace.totalResults} results found
        </span>
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
