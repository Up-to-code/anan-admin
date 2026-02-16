// Shared components and utilities for admin pages
// This file contains reusable UI patterns

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";

// ============================================
// STAT CARD COMPONENT
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
  color = "blue",
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
  const colors = statColors[color];

  const content = (
    <Card
      className={cn(
        "relative overflow-hidden group transition-all",
        href && "hover:shadow-lg hover:border-primary/20 cursor-pointer",
      )}
    >
      <div className={cn("absolute top-0 left-0 right-0 h-1", colors.bar)} />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("p-2.5 rounded-xl", colors.bg)}>
              <Icon className={cn("h-4 w-4", colors.text)} />
            </div>
          )}
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1.5 mt-3 pt-3 border-t text-xs",
              trendUp
                ? "text-emerald-600"
                : trendUp === false
                  ? "text-rose-600"
                  : "text-muted-foreground",
            )}
          >
            <span className="font-medium">{trend}</span>
          </div>
        )}
        {href && (
          <ArrowRight className="absolute bottom-3 left-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
// PAGE HEADER COMPONENT
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
    <>
      {breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{/* Dashboard */}</BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>
                      {crumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="flex items-center gap-2">
                      {Icon && i === breadcrumbs.length - 1 && (
                        <Icon className="h-4 w-4" />
                      )}
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
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action}
      </div>
    </>
  );
}

// ============================================
// EMPTY STATE COMPONENT
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
    <Card>
      <CardContent className="py-16 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ============================================
// CARD LIST ITEM
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
    <Card
      className={cn(
        "group transition-all",
        (onClick || href) &&
          "hover:shadow-md hover:border-primary/20 cursor-pointer",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className={cn("p-3 rounded-xl shrink-0", colors.bg)}>
              <Icon className={cn("h-5 w-5", colors.text)} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{title}</h3>
              {badges.map((badge, i) => (
                <Badge
                  key={i}
                  variant={badge.variant || "secondary"}
                  className={cn("text-[10px]", badge.className)}
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
          {(onClick || href) && (
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }
  return content;
}

// ============================================
// SEARCH INPUT
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
        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
        className="w-full rounded-lg border bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
    <div className="text-center text-sm text-muted-foreground py-4">
      عرض {showing} من {total}
    </div>
  );
}
