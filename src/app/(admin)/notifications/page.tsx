"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Clock,
  MessageSquare,
  Filter,
  User,
  ShoppingCart,
  Sparkles,
  Bot,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { ar } from "@/lib/ar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const priorityConfig = {
  low: { label: "منخفض", className: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
  medium: { label: "متوسط", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  high: { label: "عالٍ", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  urgent: { label: "عاجل", className: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
};

const typeConfig = {
  order: { label: "طلب", icon: ShoppingCart, color: "blue" },
  handoff: { label: "تحويل", icon: Bot, color: "violet" },
  customer: { label: "عميل", icon: User, color: "emerald" },
  llm_report: { label: "تقرير AI", icon: Sparkles, color: "amber" },
  system: { label: "نظام", icon: Bell, color: "gray" },
};

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
  };
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute top-0 left-0 right-0 h-1", `bg-${color}-500`)} />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={cn("p-2.5 rounded-xl", colors[color])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationCard({ item, onAck, onResolve }: {
  item: any;
  onAck: () => void;
  onResolve: () => void;
}) {
  const priority = priorityConfig[item.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const type = typeConfig[item.type as keyof typeof typeConfig] || typeConfig.system;
  const TypeIcon = type.icon;
  const isUrgent = item.priority === "urgent" || item.priority === "high";

  const typeReasons: Record<string, string> = {
    order: "تم إنشاء هذا الإشعار بسبب طلب جديد من العميل عبر الواتساب أو التطبيق",
    handoff: "طلب الوكيل الذكي تحويل المحادثة إلى فريق المبيعات البشري",
    customer: "تم إنشاء هذا الإشعار بسبب نشاط جديد من العميل",
    llm_report: "تم إنشاء هذا الإشعار من تقرير الذكاء الاصطناعي التلقائي",
    system: "إشعار من النظام",
  };

  return (
    <Card className={cn(
      "overflow-hidden group transition-all",
      isUrgent && "border-rose-200 dark:border-rose-800"
    )}>
      <div className={cn(
        "h-1",
        isUrgent ? "bg-rose-500" : item.read ? "bg-muted" : "bg-primary"
      )} />
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Icon */}
          <div className={cn(
            "p-3 rounded-xl shrink-0",
            isUrgent ? "bg-rose-500/10" : item.read ? "bg-muted" : "bg-primary/10"
          )}>
            {isUrgent ? (
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            ) : item.read ? (
              <CheckCheck className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Bell className="h-5 w-5 text-primary" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{item.title}</h3>
              {!item.read && (
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
              <Badge variant="outline" className={cn("text-[10px]", priority.className)}>
                {priority.label}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                <TypeIcon className="h-3 w-3 ml-1" />
                {type.label}
              </Badge>
            </div>

            {item.body && (
              <p className="text-sm text-muted-foreground mt-2">{item.body}</p>
            )}

            {/* Reason Context */}
            <div className="mt-3 p-3 rounded-lg bg-muted/50 border-r-2 border-primary/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">السبب: </span>
                {typeReasons[item.type] || "تم إنشاء هذا الإشعار من النظام"}
              </p>
              {(item.metadata as any)?.reason && (
                <p className="text-xs mt-1">
                  <span className="text-muted-foreground">تفاصيل: </span>
                  {(item.metadata as any).reason}
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(item._creationTime).toLocaleString("ar-SA")}
              </div>
              {item.entityId && (
                <div className="flex items-center gap-1">
                  {item.entityType === "order" ? (
                    <ShoppingCart className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  <code className="font-mono text-[10px]">{item.entityId.slice(-8)}</code>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            {!item.read && (
              <Button size="sm" variant="outline" onClick={onAck}>
                <CheckCheck className="h-3 w-3 ml-1" />
                تم القراءة
              </Button>
            )}
            <Button size="sm" onClick={onResolve}>
              حل
            </Button>
            {(item.metadata as any)?.userId && (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/users/${(item.metadata as any).userId}?tab=conversation`}>
                  <MessageSquare className="h-3 w-3 ml-1" />
                  محادثة
                </Link>
              </Button>
            )}
            {item.entityType === "order" && item.entityId && (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/orders/${item.entityId}`}>
                  <ChevronRight className="h-3 w-3 ml-1" />
                  الطلب
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const result = useQuery(api.features.admin.api.notificationsList, {
    paginationOpts: { cursor: null, numItems: 50 },
    unreadOnly: filter === "unread",
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const acknowledge = useMutation(api.features.admin.api.notificationAcknowledge);
  const resolve = useMutation(api.features.admin.api.notificationResolve);
  const loading = result === undefined;

  const items = React.useMemo(() => {
    if (!result?.page) return [];
    if (!search) return result.page;
    const q = search.toLowerCase();
    return result.page.filter(
      (n) => n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q)
    );
  }, [result, search]);

  const stats = React.useMemo(() => {
    if (!result) return { total: 0, unread: 0, urgent: 0 };
    return {
      total: result.page.length,
      unread: result.page.filter((n) => !n.read).length,
      urgent: result.page.filter((n) => n.priority === "urgent" || n.priority === "high").length,
    };
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">{ar.notifications}</h1>
        <p className="text-sm text-muted-foreground">الإشعارات مع سبب الإنشاء</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="الإجمالي" value={stats.total} icon={Bell} color="blue" />
        <StatCard label="غير مقروء" value={stats.unread} icon={Bell} color="emerald" />
        <StatCard label="عاجل" value={stats.urgent} icon={AlertTriangle} color="rose" />
        <StatCard label="مقروء" value={stats.total - stats.unread} icon={CheckCheck} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Filter className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar.all}</SelectItem>
            <SelectItem value="unread">{ar.unread}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="order">طلبات</SelectItem>
            <SelectItem value="handoff">تحويلات</SelectItem>
            <SelectItem value="customer">عملاء</SelectItem>
            <SelectItem value="llm_report">تقارير AI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{ar.noNotifications}</p>
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <NotificationCard
              key={item._id}
              item={item}
              onAck={() => acknowledge({ id: item._id })}
              onResolve={() => resolve({ id: item._id })}
            />
          ))
        )}
      </div>

      {!loading && items.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          عرض {items.length} إشعار
        </p>
      )}
    </div>
  );
}
