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
  Search,
  Phone,
  AlertTriangle,
  ShoppingCart,
  Target,
  CheckCircle,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  ORDER_STATUS,
  ORDER_STATUS_LIST,
  type OrderStatus,
} from "@/lib/status-config";

/* ─────────────── Stage Pill ─────────────── */
function StagePill({
  status,
  count,
  active,
  onClick,
}: {
  status: OrderStatus;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const config = ORDER_STATUS[status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
        active
          ? `${config.bgColor} ${config.textColor} ring-1 ${config.borderColor}`
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      <span
        className={cn(
          "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
          active ? "bg-background/80 text-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

/* ─────────────── Order Row ─────────────── */
function OrderRow({ order }: { order: any }) {
  const config =
    ORDER_STATUS[order.status as OrderStatus] || ORDER_STATUS.new_lead;
  const StatusIcon = config.icon;

  return (
    <Link
      href={`/orders/${order._id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all group"
    >
      {/* Status indicator */}
      <div className={cn("p-2 rounded-lg shrink-0", config.bgColor)}>
        <StatusIcon className={cn("h-4 w-4", config.textColor)} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {order.userName || ar.unnamedCustomer}
          </span>
          {order.isStale && (
            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Phone className="h-3 w-3" />
          <span dir="ltr">{order.userPhone || "-"}</span>
        </div>
      </div>

      {/* Meta */}
      <Badge className={cn("border-0 hidden sm:flex", config.bgColor, config.textColor)}>
        {config.label}
      </Badge>
      <Badge variant="outline" className="text-[10px] hidden md:flex">
        {(ar as Record<string, string>)[order.type] ?? order.type}
      </Badge>
      <div className="flex items-center gap-1 text-xs text-muted-foreground w-14 justify-end">
        <Clock className="h-3 w-3" />
        <span>{order.ageHours}س</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function OrdersPage() {
  const [search, setSearch] = React.useState("");
  const [activeStage, setActiveStage] = React.useState<string>("all");
  const isAdmin = useQuery(api.features.admin.api.isAdmin);

  const orders = useQuery(
    api.features.admin.api.listOrders,
    isAdmin === true
      ? {
        limit: 100,
        status: activeStage === "all" ? undefined : (activeStage as any),
      }
      : "skip",
  ) as any[] | undefined;

  const summary = useQuery(
    api.features.admin.api.pipelineSummary,
    isAdmin === true ? undefined : "skip",
  );

  const board = useQuery(
    api.features.admin.api.pipelineBoard,
    isAdmin === true ? { limitPerStage: 30 } : "skip",
  ) as any[] | undefined;

  const loading = orders === undefined;

  // Stage counts from board data
  const stageCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    ORDER_STATUS_LIST.forEach((s) => (counts[s] = 0));
    if (board) {
      for (const col of board) {
        counts[col.status] = col.items?.length ?? 0;
      }
    }
    return counts;
  }, [board]);

  const totalOrders = React.useMemo(
    () => Object.values(stageCounts).reduce((a, b) => a + b, 0),
    [stageCounts],
  );

  // Filtered orders
  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.userName?.toLowerCase().includes(q) ||
        o.userPhone?.includes(search) ||
        o.intent?.toLowerCase().includes(q),
    );
  }, [orders, search]);

  // Stats
  const staleCount = React.useMemo(
    () => (orders ?? []).filter((o) => o.isStale).length,
    [orders],
  );

  const conversionRate = summary?.conversionRate
    ? Math.round(summary.conversionRate * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold">{ar.pipelineOrders}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {ar.salesDashboardDesc}
        </p>
      </div>

      {/* ── Compact Summary Row ── */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الطلبات</p>
            <p className="font-bold">{totalOrders}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">تحتاج متابعة</p>
            <p className="font-bold">{staleCount}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <Target className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">التحويل</p>
            <p className="font-bold">{conversionRate}%</p>
          </div>
        </div>
      </div>

      {/* ── Stage Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveStage("all")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
            activeStage === "all"
              ? "bg-foreground text-background"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          {ar.all}
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
              activeStage === "all"
                ? "bg-background/20 text-background"
                : "bg-muted text-muted-foreground"
            )}
          >
            {totalOrders}
          </span>
        </button>
        {ORDER_STATUS_LIST.map((status) => (
          <StagePill
            key={status}
            status={status}
            count={stageCounts[status] ?? 0}
            active={activeStage === status}
            onClick={() =>
              setActiveStage(activeStage === status ? "all" : status)
            }
          />
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={ar.searchCustomersOrders}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-4 pe-10"
        />
      </div>

      {/* ── Orders List ── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {ar.noOrdersFound}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ar.tryChangingSearch}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => (
            <OrderRow key={order._id} order={order} />
          ))}
        </div>
      )}

      {/* ── Count Footer ── */}
      {!loading && filteredOrders.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          عرض {filteredOrders.length} من {totalOrders} طلب
        </p>
      )}
    </div>
  );
}
