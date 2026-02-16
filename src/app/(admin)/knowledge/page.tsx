"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Plus,
  FileText,
  ChevronRight,
  Clock,
} from "lucide-react";
import { PageHeader, StatCard, EmptyState, SearchInput, ResultCount } from "@/components/admin/ui";

function KnowledgeCard({ page }: { page: any }) {
  return (
    <Card className="group hover:shadow-md hover:border-primary/20 transition-all border-border/50 overflow-hidden cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-primary/5 text-primary border border-primary/10 shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate text-sm md:text-base group-hover:text-primary transition-colors">
              {page.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
              {page.content?.slice(0, 120)}...
            </p>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground font-mono">
              <Badge variant="secondary" className="text-[9px] h-4 font-normal bg-primary/5 text-primary border-0 scale-90 origin-right">
                {formatSize(page.content?.length || 0)}
              </Badge>
              <span className="flex items-center gap-1 opacity-70">
                <Clock className="h-3 w-3" />
                {new Date(page._creationTime).toLocaleDateString("ar-SA")}
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatSize(chars: number) {
  if (chars >= 1000) return `${(chars / 1000).toFixed(1)}k حرف`;
  return `${chars} حرف`;
}

export default function KnowledgePage() {
  const [search, setSearch] = React.useState("");
  const pages = useQuery(api.features.admin.api.knowledgeList, {}) as any[];
  const loading = pages === undefined;
  const pagesList = pages || [];

  const filteredPages = React.useMemo(() => {
    if (!pagesList) return [];
    if (!search) return pagesList;
    const q = search.toLowerCase();
    return pagesList.filter(p => p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q));
  }, [pagesList, search]);

  const stats = React.useMemo(() => {
    const totalChars = pagesList.reduce((acc, p) => acc + (p.content?.length || 0), 0);
    return { total: pagesList.length, totalChars };
  }, [pagesList]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.knowledge}
        description="قاعدة معرفة الذكاء الاصطناعي لتدريب الوكلاء."
        icon={BookOpen}
        breadcrumbs={[{ label: ar.dashboard, href: "/" }, { label: ar.knowledge }]}
        action={<Button><Plus className="ml-2 h-4 w-4" />{ar.addKnowledgePage}</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي الصفحات" value={stats.total} icon={FileText} color="blue" />
        <StatCard label="المحتوى النصي" value={`${(stats.totalChars / 1000).toFixed(1)}K`} icon={BookOpen} color="emerald" />
        <StatCard label="متوسط الطول" value={`${Math.round(stats.totalChars / (stats.total || 1))} ح`} icon={Clock} color="violet" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث في قاعدة المعرفة..." />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filteredPages.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPages.map(page => <KnowledgeCard key={page._id} page={page} />)}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={ar.noKnowledgePages}
          description="أضف صفحات لمساعدة الذكاء الاصطناعي على فهم خدماتك بشكل أفضل."
          action={<Button><Plus className="ml-2 h-4 w-4" />{ar.addKnowledgePage}</Button>}
        />
      )}

      {!loading && filteredPages.length > 0 && (
        <ResultCount showing={filteredPages.length} total={stats.total} />
      )}
    </div>
  );
}
