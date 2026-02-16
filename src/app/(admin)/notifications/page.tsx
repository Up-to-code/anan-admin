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
  User,
  ShoppingCart,
  Sparkles,
  Bot,
  ChevronRight,
} from "lucide-react";
import { ar } from "@/lib/ar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard, EmptyState, SearchInput } from "@/components/admin/ui";

const priorityConfig = {
  low: { label: "منخفض", className: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
  medium: { label: "متوسط", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  high: { label: "عالٍ", className: "bg-amber-500/10 text-amber-600 border-blue-500/20" }, // Fixed color inconsistency
  urgent: { label: "عاجل", className: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
};

const typeConfig = {
  order: { label: "طلب", icon: ShoppingCart, color: "blue" },
  handoff: { label: "تحويل", icon: Bot, color: "violet" },
  customer: { label: "عميل", icon: User, color: "emerald" },
  llm_report: { label: "تقرير AI", icon: Sparkles, color: "amber" },
  system: { label: "نظام", icon: Bell, color: "gray" },
};

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
      "overflow-hidden group transition-all border-border/50",
      isUrgent && "border-rose-200 shadow-sm"
    )}>
      <div className={cn(
        "h-1",
        isUrgent ? "bg-rose-500" : item.read ? "bg-muted" : "bg-primary"
      )} />
      <CardContent className="p-4">
        <div className="flex gap-4">
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

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm md:text-base">{item.title}</h3>
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

            <div className="mt-3 p-3 rounded-lg bg-muted/30 border-r-2 border-primary/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">السبب: </span>
                {typeReasons[item.type] || "تم إنشاء هذا الإشعار من النظام"}
              </p>
            </div>

            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground font-mono">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(item._creationTime).toLocaleString("ar-SA", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </div>
              {item.entityId && (
                <div className="flex items-center gap-1">
                  {item.entityType === "order" ? <ShoppingCart className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  <code>{item.entityId.slice(-8)}</code>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {!item.read && (
              <Button size="sm" variant="outline" onClick={onAck} className="h-8 text-xs">
                <CheckCheck className="h-3 w-3 ml-1" />
                تم القراءة
              </Button>
            )}
            <Button size="sm" onClick={onResolve} className="h-8 text-xs">
              حل
            </Button>
            {item.entityType === "order" && item.entityId && (
              <Button size="sm" variant="ghost" asChild className="h-8 text-xs">
                <Link href={`/orders/${item.entityId}`}>
                  <ChevronRight className="h-3 w-3 ml-1" />
                  التفاصيل
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
  const isAdmin = useQuery(api.features.admin.api.isAdmin);

  const result = useQuery(
    api.features.admin.api.notificationsList,
    isAdmin === true
      ? {
        paginationOpts: { cursor: null, numItems: 50 },
        unreadOnly: filter === "unread",
        type: typeFilter !== "all" ? typeFilter : undefined,
      }
      : "skip",
  );

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
      <PageHeader
        title={ar.notifications}
        description="الإشعارات التنيهية وتتبع حالة النظام."
        icon={Bell}
        breadcrumbs={[{ label: ar.dashboard, href: "/" }, { label: ar.notifications }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="الإجمالي" value={stats.total} icon={Bell} color="blue" />
        <StatCard label="عاجل" value={stats.urgent} icon={AlertTriangle} color="rose" />
        <StatCard label="غير مقروء" value={stats.unread} icon={Clock} color="amber" />
        <StatCard label="تمت معالجتها" value={stats.total - stats.unread} icon={CheckCheck} color="emerald" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث في الإشعارات..."
        />
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="unread">غير مقروء</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="order">طلبات</SelectItem>
              <SelectItem value="handoff">تحويلات</SelectItem>
              <SelectItem value="customer">عملاء</SelectItem>
              <SelectItem value="llm_report">AI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={ar.noNotifications}
            description="لا توجد تنبيهات جديدة تتطلب انتباهك حالياً."
          />
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
    </div>
  );
}
