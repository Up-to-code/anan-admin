"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
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
  BookOpen,
  Plus,
  FileText,
  ChevronRight,
  Search,
  Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: "blue" | "emerald" | "amber" | "violet";
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    violet: "bg-violet-500/10 text-violet-600",
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

function KnowledgeCard({ page }: { page: any }) {
  return (
    <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 shrink-0">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{page.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {page.content?.slice(0, 100)}...
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                {page.content?.length || 0} حرف
              </Badge>
              <span>
                {new Date(page._creationTime).toLocaleDateString("ar-SA")}
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function KnowledgePage() {
  const [search, setSearch] = React.useState("");
  const pages = useQuery(api.features.admin.api.knowledgeList, {}) as any[];
  const loading = pages === undefined;

  const pagesList = pages || [];

  const filteredPages = React.useMemo(() => {
    if (!pagesList) return [];
    if (!search) return pagesList;
    const searchLower = search.toLowerCase();
    return pagesList.filter(
      (page: any) =>
        page.title?.toLowerCase().includes(searchLower) ||
        page.content?.toLowerCase().includes(searchLower),
    );
  }, [pagesList, search]);

  const stats = React.useMemo(() => {
    const totalChars = pagesList.reduce(
      (acc: number, p: any) => acc + (p.content?.length || 0),
      0,
    );
    return {
      total: pagesList.length,
      totalChars,
    };
  }, [pagesList]);

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
              <BookOpen className="h-4 w-4" />
              {ar.knowledge}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{ar.knowledge}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            قاعدة معرفة الذكاء الاصطناعي
          </p>
        </div>
        <Button>
          <Plus className="ml-2 h-4 w-4" />
          {ar.addKnowledgePage}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="الصفحات"
          value={stats.total}
          icon={BookOpen}
          color="blue"
        />
        <StatCard
          label="المحتوى"
          value={`${(stats.totalChars / 1000).toFixed(1)}K`}
          icon={FileText}
          color="emerald"
        />
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث في قاعدة المعرفة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredPages.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPages.map((page: any) => (
            <KnowledgeCard key={page._id} page={page} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-muted-foreground font-medium">
              {ar.noKnowledgePages}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              أضف صفحات للمساعدة في تدريب الذكاء الاصطناعي
            </p>
            <Button className="mt-4">
              <Plus className="ml-2 h-4 w-4" />
              {ar.addKnowledgePage}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
