"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent } from "@/components/ui/card";
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
import { Heart, User, Building2, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "rose",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: "rose" | "emerald" | "blue" | "violet";
}) {
  const colorClasses: Record<string, string> = {
    rose: "bg-rose-500/10 text-rose-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/10 text-blue-600",
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

function FavoriteCard({ favorite }: { favorite: any }) {
  return (
    <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-rose-500/10 shrink-0">
            <Heart className="h-5 w-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">
              {favorite.title || "عقار مفضل"}
            </h3>
            {favorite.location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{favorite.location}</span>
              </div>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {favorite.userName && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{favorite.userName}</span>
                </div>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function FavoritesPage() {
  const favorites = useQuery(api.features.admin.api.favoritesList, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const loading = favorites === undefined;

  const favoritesList = favorites?.page || [];

  const stats = React.useMemo(() => {
    return {
      total: favoritesList.length,
    };
  }, [favoritesList]);

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
              <Heart className="h-4 w-4" />
              {ar.favorites}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-bold">{ar.favorites}</h1>
        <p className="text-sm text-muted-foreground mt-1">{ar.engagement}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المفضلات"
          value={stats.total}
          icon={Heart}
          color="rose"
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : favoritesList.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoritesList.map((favorite: any) => (
            <FavoriteCard key={favorite._id} favorite={favorite} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
              <Heart className="h-6 w-6 text-rose-600" />
            </div>
            <p className="text-muted-foreground font-medium">
              {ar.noFavorites}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              لم يقم أي مستخدم بإضافة مفضلات بعد
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
