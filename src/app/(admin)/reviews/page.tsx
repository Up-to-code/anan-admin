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
  Star,
  MessageSquare,
  User,
  Building2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "amber",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: "amber" | "emerald" | "blue" | "violet";
}) {
  const colorClasses: Record<string, string> = {
    amber: "bg-amber-500/10 text-amber-600",
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

function ReviewCard({ review }: { review: any }) {
  return (
    <Card className="group hover:shadow-md hover:border-primary/20 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 shrink-0">
            <Star className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">
                {review.title || "تقييم"}
              </h3>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-3 w-3",
                      star <= (review.rating || 5)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted",
                    )}
                  />
                ))}
              </div>
            </div>
            {review.comment && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {review.comment}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {review.userName && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{review.userName}</span>
                </div>
              )}
              {review.propertyName && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span>{review.propertyName}</span>
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

export default function ReviewsPage() {
  const reviews = useQuery(api.features.admin.api.reviewsList, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const loading = reviews === undefined;

  const reviewsList = reviews?.page || [];

  const stats = React.useMemo(() => {
    if (!reviewsList || reviewsList.length === 0)
      return { total: 0, avgRating: 0, fiveStar: 0 };
    const total = reviewsList.length;
    const sum = reviewsList.reduce(
      (acc: number, r: any) => acc + (r.rating || 0),
      0,
    );
    const fiveStar = reviewsList.filter((r: any) => r.rating === 5).length;
    return {
      total,
      avgRating: total > 0 ? (sum / total).toFixed(1) : "0",
      fiveStar,
    };
  }, [reviewsList]);

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
              <Star className="h-4 w-4" />
              {ar.reviews}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-bold">{ar.reviews}</h1>
        <p className="text-sm text-muted-foreground mt-1">{ar.engagement}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي التقييمات"
          value={stats.total}
          icon={MessageSquare}
          color="amber"
        />
        <StatCard
          label="متوسط التقييم"
          value={stats.avgRating}
          icon={Star}
          color="emerald"
        />
        <StatCard
          label="تقييم 5 نجوم"
          value={stats.fiveStar}
          icon={Star}
          color="blue"
        />
        <StatCard
          label="نسبة الرضا"
          value={`${stats.total > 0 ? Math.round((stats.fiveStar / stats.total) * 100) : 0}%`}
          icon={Star}
          color="violet"
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : reviewsList.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviewsList.map((review: any) => (
            <ReviewCard key={review._id} review={review} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-muted-foreground font-medium">{ar.noReviews}</p>
            <p className="text-sm text-muted-foreground mt-1">
              لم يقم أي مستخدم بكتابة تقييم بعد
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
