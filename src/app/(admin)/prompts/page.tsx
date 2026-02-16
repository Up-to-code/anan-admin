"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  EmptyState,
  SearchInput,
  ResultCount,
} from "@/components/admin/ui";

function PromptCard({ prompt }: { prompt: any }) {
  return (
    <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 shrink-0">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate font-mono text-sm">
                {prompt.key}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {prompt.value?.slice(0, 120)}...
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary" className="text-[10px]">
                {prompt.value?.length || 0} حرف
              </Badge>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PromptsPage() {
  const [search, setSearch] = React.useState("");
  const prompts = useQuery(api.features.admin.api.promptsList, {});
  const loading = prompts === undefined;

  const filteredPrompts = React.useMemo(() => {
    if (!prompts) return [];
    if (!search) return prompts;
    const searchLower = search.toLowerCase();
    return prompts.filter(
      (p) =>
        p.key?.toLowerCase().includes(searchLower) ||
        p.value?.toLowerCase().includes(searchLower),
    );
  }, [prompts, search]);

  const stats = React.useMemo(() => {
    const totalChars =
      prompts?.reduce(
        (acc: number, p: any) => acc + (p.value?.length || 0),
        0,
      ) || 0;
    return {
      total: prompts?.length || 0,
      totalChars,
    };
  }, [prompts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.prompts}
        description={ar.content}
        icon={Sparkles}
        breadcrumbs={[
          { label: ar.dashboard, href: "/" },
          { label: ar.prompts },
        ]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="القوالب"
          value={stats.total}
          icon={FileText}
          color="violet"
        />
        <StatCard
          label="المحتوى"
          value={`${(stats.totalChars / 1000).toFixed(1)}K`}
          icon={Sparkles}
          color="emerald"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث في القوالب..."
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredPrompts.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrompts.map((prompt) => (
            <PromptCard key={prompt._id} prompt={prompt} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title={ar.noPrompts}
          description={ar.noPromptsCurrently}
        />
      )}

      {!loading && filteredPrompts.length > 0 && (
        <ResultCount
          showing={filteredPrompts.length}
          total={stats.total}
        />
      )}
    </div>
  );
}
