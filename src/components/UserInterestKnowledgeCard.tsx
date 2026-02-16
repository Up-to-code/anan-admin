"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Link2, Heart } from "lucide-react";

type OrderLike = {
  status?: string;
  confidenceScore?: number | null;
} | null;

const highInterestStatuses = ["qualified", "offer_made", "under_contract", "closed_won"];
const mediumInterestStatuses = ["contacted"];

function deriveInterest(order: OrderLike): { label: string; variant: "default" | "secondary" | "success" | "warning" } {
  if (!order?.status) return { label: ar.unknownInterest, variant: "default" };
  if (highInterestStatuses.includes(order.status)) {
    const confidence = order.confidenceScore ?? 0;
    return {
      label: confidence >= 0.7 ? ar.highInterest : ar.mediumInterest,
      variant: "success",
    };
  }
  if (mediumInterestStatuses.includes(order.status)) {
    return { label: ar.mediumInterest, variant: "warning" };
  }
  return { label: ar.lowInterest, variant: "secondary" };
}

type KnowledgeResearchRecord = {
  _id: string;
  query: string;
  createdAt: number;
  status?: string;
  sourceRuns?: Array<{ url: string; title?: string }>;
  propertyFindings?: Array<{ propertyUrl?: string; sourceUrl?: string; title?: string }>;
};

export function UserInterestKnowledgeCard({
  userId,
  order,
}: {
  userId: string;
  order: OrderLike;
}) {
  const research = useQuery(api.features.admin.api.knowledgeResearchList, {
    userId,
    paginationOpts: { cursor: null, numItems: 15 },
  }) as { page: KnowledgeResearchRecord[] } | undefined;

  const interest = deriveInterest(order);
  const records = research?.page ?? [];

  const queries = React.useMemo(
    () => records.filter((r) => r.status === "completed").map((r) => ({ query: r.query, createdAt: r.createdAt })),
    [records]
  );

  const links = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ url: string; title?: string }> = [];
    for (const r of records) {
      for (const sr of r.sourceRuns ?? []) {
        if (sr.url && !seen.has(sr.url)) {
          seen.add(sr.url);
          out.push({ url: sr.url, title: sr.title });
        }
      }
      for (const pf of r.propertyFindings ?? []) {
        if (pf.propertyUrl && !seen.has(pf.propertyUrl)) {
          seen.add(pf.propertyUrl);
          out.push({ url: pf.propertyUrl, title: pf.title });
        }
        if (pf.sourceUrl && !seen.has(pf.sourceUrl)) {
          seen.add(pf.sourceUrl);
          out.push({ url: pf.sourceUrl, title: pf.title });
        }
      }
    }
    return out.slice(0, 20);
  }, [records]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="h-5 w-5" />
          {ar.customerInterest} · {ar.knowledgeBase}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{ar.interestLevel}</p>
          <Badge variant={interest.variant}>{interest.label}</Badge>
        </div>
        <Separator />
        <div>
          <p className="text-sm font-medium flex items-center gap-1 mb-2">
            <Search className="h-4 w-4" />
            {ar.searchQueries}
          </p>
          {queries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar.noSearchHistory}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {queries.map((q, i) => (
                <li key={`${q.createdAt}-${i}`} className="flex justify-between gap-2">
                  <span>{q.query}</span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {new Date(q.createdAt).toLocaleDateString("ar-SA")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Separator />
        <div>
          <p className="text-sm font-medium flex items-center gap-1 mb-2">
            <Link2 className="h-4 w-4" />
            {ar.linksSearched}
          </p>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar.noLinksSearched}</p>
          ) : (
            <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
              {links.map((l, i) => (
                <li key={`${l.url}-${i}`}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate block max-w-full"
                    dir="ltr"
                  >
                    {l.title || l.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
