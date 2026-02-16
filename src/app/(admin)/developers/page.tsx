"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Building2,
  Mail,
  ChevronRight,
  Globe,
  Phone,
  Home,
  CheckCircle,
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

function DeveloperCard({
  developer,
  propertiesCount,
}: {
  developer: any;
  propertiesCount?: number;
}) {
  const isActive = developer.status === "active";

  return (
    <Link href={`/developers/${developer._id}`}>
      <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer overflow-hidden">
        <div
          className={cn("h-1", isActive ? "bg-emerald-500" : "bg-gray-400")}
        />
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "p-3 rounded-xl shrink-0",
                isActive ? "bg-emerald-500/10" : "bg-muted",
              )}
            >
              <Building2
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-emerald-600" : "text-muted-foreground",
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{developer.name}</h3>
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className={cn(
                    "text-[10px]",
                    isActive &&
                      "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
                  )}
                >
                  {isActive ? ar.active : ar.inactive}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                {developer.slug}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {developer.contactEmail && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">
                      {developer.contactEmail}
                    </span>
                  </div>
                )}
                {propertiesCount !== undefined && (
                  <div className="flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    <span>{ar.propertyCount.replace("{n}", String(propertiesCount))}</span>
                  </div>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DevelopersPage() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const developers = useQuery(api.features.partners.queries.list);
  const properties = useQuery(api.features.admin.api.propertiesList, {}) as
    | any[]
    | undefined;
  const loading = developers === undefined;

  const filteredDevelopers = React.useMemo(() => {
    if (!developers) return [];
    let filtered = developers;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (dev) =>
          dev.name?.toLowerCase().includes(searchLower) ||
          dev.slug?.toLowerCase().includes(searchLower) ||
          dev.contactEmail?.toLowerCase().includes(searchLower),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (d) => (d.status ?? "inactive") === statusFilter,
      );
    }

    return filtered;
  }, [developers, search, statusFilter]);

  const stats = React.useMemo(() => {
    if (!developers)
      return { total: 0, active: 0, inactive: 0, withProperties: 0 };
    const active = developers.filter((d) => d.status === "active").length;
    return {
      total: developers.length,
      active,
      inactive: developers.length - active,
      withProperties: developers.filter((d) =>
        properties?.some((p: any) => p.partnerId === d._id),
      ).length,
    };
  }, [developers, properties]);

  const getPropertiesCount = (developerId: string) => {
    return (
      properties?.filter((p: any) => p.partnerId === developerId).length || 0
    );
  };

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
              <Building2 className="h-4 w-4" />
              {ar.developers}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{ar.developers}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar.manageDevelopersDesc}
          </p>
        </div>
        <Button asChild>
          <Link href="/developers/create">
            <Plus className="ml-2 h-4 w-4" />
            {ar.addDeveloper}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={ar.totalDevelopers}
          value={stats.total}
          icon={Building2}
          color="blue"
        />
        <StatCard
          label={ar.active}
          value={stats.active}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          label={ar.inactive}
          value={stats.inactive}
          icon={Activity}
          color="amber"
        />
        <StatCard
          label={ar.withProperties}
          value={stats.withProperties}
          icon={Home}
          color="violet"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={ar.searchDevelopersPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
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
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredDevelopers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {ar.noDevelopers}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {ar.tryChangingSearch}
            </p>
            <Button asChild className="mt-4">
              <Link href="/developers/create">
                <Plus className="ml-2 h-4 w-4" />
                {ar.addDeveloper}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevelopers.map((developer) => (
            <DeveloperCard
              key={developer._id}
              developer={developer}
              propertiesCount={getPropertiesCount(developer._id)}
            />
          ))}
        </div>
      )}

      {!loading && filteredDevelopers.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          عرض {filteredDevelopers.length} من {stats.total} مطور
        </div>
      )}
    </div>
  );
}
