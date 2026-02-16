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
import { StatCard, PageHeader, EmptyState, ResultCount } from "@/components/admin/ui";

function PropertyCard({ property }: { property: any }) {
  const statusConfig = {
    available: {
      label: ar.available,
      class: "bg-emerald-500/10 text-emerald-600",
      border: "border-emerald-200/50",
    },
    sold: {
      label: ar.sold,
      class: "bg-rose-500/10 text-rose-600",
      border: "border-rose-200/50",
    },
    reserved: {
      label: ar.reserved,
      class: "bg-amber-500/10 text-amber-600",
      border: "border-amber-200/50",
    },
  };
  const status =
    statusConfig[property.status as keyof typeof statusConfig] ||
    statusConfig.available;

  return (
    <Link href={`/properties/${property._id}`}>
      <Card className="group transition-all hover:shadow-md hover:border-primary/20 cursor-pointer overflow-hidden border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-xl shrink-0 transition-colors", status.class)}>
              <Home className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium truncate text-base">{property.title}</h3>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-normal h-5 ml-auto shrink-0", status.class, status.border)}
                >
                  {status.label}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 mb-3">
                <MapPin className="h-3.5 w-3.5 opacity-70" />
                <span className="truncate">
                  {property.location || property.area || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/40">
                {property.price && (
                  <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                    <DollarSign className="h-3.5 w-3.5" />
                    {property.price.toLocaleString("ar-SA")}
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {property.beds && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-3.5 w-3.5 opacity-70" />
                      {property.beds}
                    </div>
                  )}
                  {property.baths && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5 opacity-70" />
                      {property.baths}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors self-center mt-1" />
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
      <PageHeader
        title={ar.properties}
        description={ar.managePropertiesDesc}
        icon={Building2}
        breadcrumbs={[{ label: ar.properties }]}
        action={
          <Button asChild>
            <Link href="/properties/create">
              <Plus className="ml-2 h-4 w-4" />
              {ar.addProperty}
            </Link>
          </Button>
        }
      />

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
        <EmptyState
          icon={Building2}
          title={ar.noPropertiesFound}
          description={ar.tryChangingSearch}
          action={
            <Button asChild>
              <Link href="/properties/create">
                <Plus className="ml-2 h-4 w-4" />
                {ar.addProperty}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProperties.map((property) => (
            <PropertyCard key={property._id} property={property} />
          ))}
        </div>
      )}

      {!loading && filteredProperties.length > 0 && (
        <ResultCount showing={filteredProperties.length} total={stats.total} />
      )}
    </div>
  );
}
