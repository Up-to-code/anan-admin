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
  Plus,
  Building2,
  Mail,
  ChevronRight,
  Home,
  CheckCircle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatCard, EmptyState, SearchInput } from "@/components/admin/ui";

function DeveloperCard({
  developer,
  propertiesCount,
}: {
  developer: any;
  propertiesCount?: number;
}) {
  const isActive = developer.status === "active";

  return (
    <Card className="group hover:shadow-md hover:border-primary/20 transition-all border-border/50 overflow-hidden">
      <div className={cn("h-1", isActive ? "bg-emerald-500" : "bg-muted")} />
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("p-2.5 rounded-xl shrink-0 border border-border/50", isActive ? "bg-emerald-500/5 text-emerald-600" : "bg-muted text-muted-foreground")}>
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/developers/${developer._id}`} className="font-bold truncate hover:text-primary transition-colors block">
                {developer.name}
              </Link>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate opacity-70">
              {developer.slug}
            </p>
            <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground">
              {developer.contactEmail && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 opacity-70" />
                  <span className="truncate max-w-[120px]">{developer.contactEmail}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Home className="h-3 w-3 opacity-70" />
                <span>{propertiesCount ?? 0} وحدات</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={isActive ? "default" : "secondary"} className={cn("text-[10px] scale-90", isActive && "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 border-emerald-200")}>
              {isActive ? ar.active : ar.inactive}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
              <Link href={`/developers/${developer._id}`}><ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DevelopersPage() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const developers = useQuery(api.features.partners.queries.list);
  const properties = useQuery(api.features.admin.api.propertiesList, {}) as any[] | undefined;
  const loading = developers === undefined;

  const filteredDevelopers = React.useMemo(() => {
    if (!developers) return [];
    let filtered = developers;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(d => d.name?.toLowerCase().includes(q) || d.slug?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(d => (d.status ?? "inactive") === statusFilter);
    }
    return filtered;
  }, [developers, search, statusFilter]);

  const stats = React.useMemo(() => {
    if (!developers) return { total: 0, active: 0, inactive: 0, withProperties: 0 };
    const active = developers.filter(d => d.status === "active").length;
    return {
      total: developers.length,
      active,
      inactive: developers.length - active,
      withProperties: developers.filter(d => properties?.some(p => p.partnerId === d._id)).length,
    };
  }, [developers, properties]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.developers}
        description={ar.manageDevelopersDesc}
        icon={Building2}
        breadcrumbs={[{ label: ar.dashboard, href: "/" }, { label: ar.developers }]}
        action={<Button asChild><Link href="/developers/create"><Plus className="ml-2 h-4 w-4" />{ar.addDeveloper}</Link></Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={ar.totalDevelopers} value={stats.total} icon={Building2} color="blue" />
        <StatCard label={ar.active} value={stats.active} icon={CheckCircle} color="emerald" />
        <StatCard label="بإنتظار التفعيل" value={stats.inactive} icon={Activity} color="amber" />
        <StatCard label="لديهم عقارات" value={stats.withProperties} icon={Home} color="violet" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder={ar.searchDevelopersPlaceholder} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={ar.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar.all}</SelectItem>
            <SelectItem value="active">{ar.active}</SelectItem>
            <SelectItem value="inactive">{ar.inactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filteredDevelopers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={ar.noDevelopers}
          description={ar.tryChangingSearch}
          action={<Button asChild><Link href="/developers/create">{ar.addDeveloper}</Link></Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevelopers.map(dev => (
            <DeveloperCard
              key={dev._id}
              developer={dev}
              propertiesCount={properties?.filter(p => p.partnerId === dev._id).length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
