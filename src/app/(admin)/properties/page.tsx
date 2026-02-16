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
  MapPin,
  ChevronRight,
  Home,
  Bed,
  Bath,
  CheckCircle,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
  description,
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: "blue" | "emerald" | "amber" | "rose";
  description?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
  };

  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn("absolute top-0 left-0 right-0 h-1", `bg-${color}-500`)}
      />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
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

function PropertyCard({ property }: { property: any }) {
  const statusConfig = {
    available: {
      label: ar.available,
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    sold: {
      label: ar.sold,
      className: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    },
    reserved: {
      label: ar.reserved,
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
  };
  const status =
    statusConfig[property.status as keyof typeof statusConfig] ||
    statusConfig.available;

  return (
    <Link href={`/properties/${property._id}`}>
      <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer overflow-hidden">
        <div
          className={cn(
            "h-1",
            property.status === "sold"
              ? "bg-rose-500"
              : property.status === "reserved"
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
        />
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-xl shrink-0", status.className)}>
              <Home className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{property.title}</h3>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {property.location || property.area || "-"}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                {property.price && (
                  <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                    <DollarSign className="h-3 w-3" />
                    {property.price.toLocaleString("ar-SA")} ر.س
                  </div>
                )}
                {(property.beds || property.baths) && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {property.beds && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-3 w-3" />
                        {property.beds}
                      </div>
                    )}
                    {property.baths && (
                      <div className="flex items-center gap-1">
                        <Bath className="h-3 w-3" />
                        {property.baths}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px]", status.className)}
            >
              {status.label}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PropertiesPage() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const properties = useQuery(api.features.admin.api.propertiesList, {
    limit: 200,
  }) as any[] | undefined;
  const loading = properties === undefined;

  const filteredProperties = React.useMemo(() => {
    if (!properties) return [];
    let filtered = properties;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (prop) =>
          prop.title?.toLowerCase().includes(searchLower) ||
          prop.location?.toLowerCase().includes(searchLower) ||
          prop.area?.toLowerCase().includes(searchLower),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (p) => (p.status ?? "available") === statusFilter,
      );
    }

    return filtered;
  }, [properties, search, statusFilter]);

  const stats = React.useMemo(() => {
    if (!properties) return { total: 0, available: 0, sold: 0, reserved: 0 };
    return {
      total: properties.length,
      available: properties.filter((p) => !p.status || p.status === "available")
        .length,
      sold: properties.filter((p) => p.status === "sold").length,
      reserved: properties.filter((p) => p.status === "reserved").length,
    };
  }, [properties]);

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
              <Home className="h-4 w-4" />
              {ar.properties}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{ar.properties}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar.managePropertiesDesc}
          </p>
        </div>
        <Button asChild>
          <Link href="/properties/create">
            <Plus className="ml-2 h-4 w-4" />
            {ar.addProperty}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي العقارات"
          value={stats.total}
          icon={Building2}
          color="blue"
        />
        <StatCard
          label="متاحة"
          value={stats.available}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          label="مباعة"
          value={stats.sold}
          icon={TrendingUp}
          color="rose"
        />
        <StatCard
          label="محجوزة"
          value={stats.reserved}
          icon={Building2}
          color="amber"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={ar.searchProperties}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={ar.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar.all}</SelectItem>
            <SelectItem value="available">{ar.available}</SelectItem>
            <SelectItem value="sold">{ar.sold}</SelectItem>
            <SelectItem value="reserved">{ar.reserved}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {ar.noPropertiesFound}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {ar.tryChangingSearch}
            </p>
            <Button asChild className="mt-4">
              <Link href="/properties/create">
                <Plus className="ml-2 h-4 w-4" />
                {ar.addProperty}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProperties.map((property) => (
            <PropertyCard key={property._id} property={property} />
          ))}
        </div>
      )}

      {!loading && filteredProperties.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {ar.showingCountOfTotal
                  .replace("{count}", String(filteredProperties.length))
                  .replace("{total}", String(stats.total))}
        </div>
      )}
    </div>
  );
}
