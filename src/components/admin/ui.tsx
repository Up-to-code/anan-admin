// Shared components and utilities for admin pages
// This file contains reusable UI patterns

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowRight, ChevronRight, TrendingUp, type LucideIcon } from "lucide-react";

// ============================================
// STAT CARD COMPONENT (Redesigned)
// ============================================

const statColors = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-600", bar: "bg-blue-500" },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    bar: "bg-emerald-500",
  },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600", bar: "bg-amber-500" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600", bar: "bg-rose-500" },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-600",
    bar: "bg-violet-500",
  },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600", bar: "bg-cyan-500" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue", // Kept for API compatibility, but usage minimized
  trend,
  trendUp,
  href,
  description,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  color?: keyof typeof statColors;
  trend?: string;
  trendUp?: boolean;
  href?: string;
  description?: string;
}) {

  const content = (
    <Card
      className={cn(
        "group transition-all border-border/50 shadow-sm",
        href && "hover:shadow-md hover:border-primary/20 cursor-pointer",
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>
        {(trend || description) && (
          <div className="flex items-center gap-2 mt-4 text-xs">
            {trend && (
              <span
                className={cn(
                  "flex items-center font-medium",
                  trendUp === true && "text-emerald-600",
                  trendUp === false && "text-rose-600",
                  trendUp === undefined && "text-muted-foreground"
                )}
              >
                {trendUp === true && <TrendingUp className="h-3 w-3 mr-1" />}
                {trend}
              </span>
            )}
            {description && (
              <span className="text-muted-foreground truncate max-w-[140px]">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ============================================
// PAGE HEADER COMPONENT (Redesigned)
// ============================================

export function PageHeader({
  title,
  description,
  icon: Icon,
  action,
  breadcrumbs = [],
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="space-y-4 pb-4">
      {breadcrumbs.length > 0 && (
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{/* Dashboard */}</BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href} className="transition-colors hover:text-foreground">
                      {crumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="font-medium">
                      {crumb.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {Icon && <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>}
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <Separator className="mt-4 opacity-50" />
    </div>
  );
}

// ============================================
// EMPTY STATE COMPONENT (Redesigned)
// ============================================

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-muted rounded-xl bg-muted/20">
      <div className="mx-auto w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-4 shadow-sm">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Separator />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl border border-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-80 md:col-span-2 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

// ============================================
// CARD LIST ITEM (Redesigned)
// ============================================

export function CardListItem({
  icon: Icon,
  iconColor = "blue",
  title,
  subtitle,
  badges = [],
  actions,
  onClick,
  href,
}: {
  icon?: LucideIcon;
  iconColor?: keyof typeof statColors;
  title: string;
  subtitle?: string;
  badges?: Array<{
    label: string;
    variant?: "default" | "secondary" | "outline" | "destructive";
    className?: string;
  }>;
  actions?: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const colors = statColors[iconColor];

  const content = (
    <div
      className={cn(
        "group flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all",
        (onClick || href) && "cursor-pointer"
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        {Icon && (
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border border-border/50 bg-background", colors.text)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate text-sm md:text-base">{title}</span>
            {badges.map((badge, i) => (
              <Badge
                key={i}
                variant={badge.variant || "secondary"}
                className={cn("text-[10px] h-5 px-1.5 font-normal", badge.className)}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {actions}
        {(onClick || href) && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }
  return content;
}

// ============================================
// SEARCH INPUT (Redesigned)
// ============================================

export function SearchInput({
  value,
  onChange,
  placeholder = "ابحث...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1">
      <svg
        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background/50 px-4 py-2 pr-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
      />
    </div>
  );
}

// ============================================
// RESULT COUNT
// ============================================

export function ResultCount({
  showing,
  total,
}: {
  showing: number;
  total: number;
}) {
  return (
    <div className="text-center text-xs text-muted-foreground py-4 bg-muted/10 rounded-lg border border-border/20">
      عرض <span className="font-medium text-foreground">{showing}</span> من <span className="font-medium text-foreground">{total}</span>
    </div>
  );
}
