"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  FileText,
  Search,
  ChevronRight,
  Sparkles,
  Save,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "violet",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: "violet" | "emerald" | "amber" | "blue";
}) {
  const colorClasses: Record<string, string> = {
    violet: "bg-violet-500/10 text-violet-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-blue-500/10 text-blue-600",
  };

  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn("absolute top-0 left-0 right-0 h-1", `bg-${color}-500`)}
      />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          {Icon && (
            <div className={cn("p-2.5 rounded-xl", colorClasses[color])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">{ar.dashboard}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {ar.prompts}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-bold">{ar.prompts}</h1>
        <p className="text-sm text-muted-foreground mt-1">{ar.content}</p>
      </div>

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
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث في القوالب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
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
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-violet-600" />
            </div>
            <p className="text-muted-foreground font-medium">{ar.noPrompts}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {ar.noPromptsCurrently}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && filteredPrompts.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {ar.showingCountOfTotalPrompts
              .replace("{count}", String(filteredPrompts.length))
              .replace("{total}", String(stats.total))}
        </div>
      )}
    </div>
  );
}
