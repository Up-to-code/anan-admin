"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  LayoutGrid,
  List,
  Filter,
  Phone,
  AlertTriangle,
  ShoppingCart,
  Target,
  CheckCircle,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  ORDER_STATUS_LIST,
  type OrderStatus,
} from "@/lib/status-config";

// ============================================
// DRAGGABLE ORDER CARD
// ============================================
function DraggableOrderCard({ order }: { order: any }) {
  const config = ORDER_STATUS[order.status as OrderStatus] || ORDER_STATUS.new_lead;
  const StatusIcon = config.icon;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order._id,
    data: { order },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-xl border bg-card p-3 transition-all",
        isDragging
          ? "shadow-xl ring-2 ring-primary opacity-90 cursor-grabbing"
          : "cursor-grab hover:shadow-md"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", config.bgColor)}>
          <StatusIcon className={cn("h-4 w-4", config.textColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/orders/${order._id}`} onClick={(e) => e.stopPropagation()}>
            <h4 className="font-medium text-sm truncate hover:text-primary">
              {order.userName || ar.unnamedCustomer}
            </h4>
          </Link>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span dir="ltr">{order.userPhone || "-"}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary" className="text-[10px]">
              {(ar as Record<string, string>)[order.type] ?? order.type}
            </Badge>
            <span className={cn(
              "text-xs font-medium",
              order.isStale ? "text-amber-600" : "text-muted-foreground"
            )}>
              {order.ageHours}س
            </span>
          </div>
          {order.isStale && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 rounded px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              يحتاج متابعة
            </div>
          )}
        </div>
        <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
      </div>
    </div>
  );
}

// ============================================
// STATIC ORDER CARD (for overlay and display)
// ============================================
function StaticOrderCard({ order }: { order: any }) {
  const config = ORDER_STATUS[order.status as OrderStatus] || ORDER_STATUS.new_lead;
  const StatusIcon = config.icon;

  return (
    <div className="rounded-xl border bg-card p-3 shadow-xl ring-2 ring-primary">
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", config.bgColor)}>
          <StatusIcon className={cn("h-4 w-4", config.textColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{order.userName || ar.unnamedCustomer}</h4>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span dir="ltr">{order.userPhone || "-"}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary" className="text-[10px]">
              {(ar as Record<string, string>)[order.type] ?? order.type}
            </Badge>
            <span className="text-xs font-medium">{order.ageHours}س</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DROPPABLE COLUMN
// ============================================
function PipelineColumn({ status, items }: { status: OrderStatus; items: any[] }) {
  const config = ORDER_STATUS[status];
  const StatusIcon = config.icon;

  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col w-[280px] shrink-0">
      {/* Column Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 rounded-t-xl border border-b-0",
        config.bgColor,
        config.borderColor
      )}>
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-4 w-4", config.textColor)} />
          <h3 className={cn("text-sm font-semibold", config.textColor)}>
            {config.label}
          </h3>
        </div>
        <Badge variant="secondary" className="font-bold text-xs">
          {items.length}
        </Badge>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[300px] p-2 border border-t-0 rounded-b-xl transition-all",
          isOver
            ? "bg-primary/10 ring-2 ring-primary/50 ring-inset"
            : "bg-muted/40"
        )}
      >
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-2 p-1">
            {items.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center">
                <p className="text-xs text-muted-foreground">اسحب الطلبات هنا</p>
              </div>
            ) : (
              items.map((item) => (
                <DraggableOrderCard key={item._id} order={item} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ============================================
// TABLE ROW
// ============================================
function OrderRow({ order }: { order: any }) {
  const config = ORDER_STATUS[order.status as OrderStatus] || ORDER_STATUS.new_lead;
  const StatusIcon = config.icon;

  return (
    <Link
      href={`/orders/${order._id}`}
      className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all group"
    >
      <div className={cn("p-2.5 rounded-xl", config.bgColor)}>
        <StatusIcon className={cn("h-5 w-5", config.textColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{order.userName || ar.unnamedCustomer}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Phone className="h-3 w-3" />
          <span dir="ltr">{order.userPhone || "-"}</span>
        </div>
      </div>
      <Badge className={cn("border-0", config.bgColor, config.textColor)}>
        {config.label}
      </Badge>
      <Badge variant="outline" className="text-xs">
        {(ar as Record<string, string>)[order.type] ?? order.type}
      </Badge>
      <span className="text-xs text-muted-foreground w-10">
        {order.ageHours}س
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </Link>
  );
}

// ============================================
// MAIN PAGE
// ============================================
export default function OrdersPage() {
  const [mode, setMode] = React.useState<"pipeline" | "table">("pipeline");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const orders = useQuery(api.features.admin.api.listOrders, {
    limit: 100,
    status: statusFilter === "all" ? undefined : (statusFilter as any),
  }) as any[] | undefined;

  const board = useQuery(api.features.admin.api.pipelineBoard, {
    limitPerStage: 30,
  }) as any[] | undefined;

  const summary = useQuery(api.features.admin.api.pipelineSummary);
  const updateOrder = useMutation(api.features.admin.api.orderUpdate);

  const loading = orders === undefined || board === undefined;

  // Flatten all orders for lookup
  const allOrders = React.useMemo(() => {
    if (!board) return orders || [];
    const items: any[] = [];
    for (const column of board) {
      if (column.items) items.push(...column.items);
    }
    return items;
  }, [board, orders]);

  // Sensors for drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const orderId = active.id as string;
    const newStatus = over.id as string;

    // Check if dropped on a column
    if (!ORDER_STATUS_LIST.includes(newStatus as any)) return;

    // Find current order
    const currentOrder = allOrders.find((o) => o._id === orderId);
    if (!currentOrder) {
      toast.error("لم يتم العثور على الطلب");
      return;
    }

    // Check transition validity
    const allowed = ORDER_TRANSITIONS[currentOrder.status] || [];
    if (!allowed.includes(newStatus)) {
      const currentConfig = ORDER_STATUS[currentOrder.status as OrderStatus];
      const newConfig = ORDER_STATUS[newStatus as OrderStatus];
      toast.error(`لا يمكن نقل من "${currentConfig?.label}" إلى "${newConfig?.label}"`);
      return;
    }

    // Update order
    try {
      await updateOrder({ id: orderId as any, status: newStatus as any });
      toast.success(`تم نقل الطلب إلى "${ORDER_STATUS[newStatus as OrderStatus]?.label}"`);
    } catch (error) {
      console.error("Failed to update order:", error);
      toast.error("فشل تحديث الحالة");
    }
  };

  // Filtered orders for table view
  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    if (!search) return orders;
    const searchLower = search.toLowerCase();
    return orders.filter(
      (order) =>
        order.userName?.toLowerCase().includes(searchLower) ||
        order.userPhone?.includes(search) ||
        order.intent?.toLowerCase().includes(searchLower)
    );
  }, [orders, search]);

  // Stats
  const stats = React.useMemo(() => {
    if (!orders) return { total: 0, stale: 0, won: 0, conversion: 0 };
    const total = orders.length;
    const won = orders.filter((o) => o.status === "closed_won").length;
    return {
      total,
      stale: orders.filter((o) => o.isStale).length,
      won,
      conversion: total > 0 ? Math.round((won / total) * 100) : 0,
    };
  }, [orders]);

  // Active order for overlay
  const activeOrder = activeId ? allOrders.find((o) => o._id === activeId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{ar.pipelineOrders}</h1>
          <p className="text-sm text-muted-foreground">{ar.salesDashboardDesc}</p>
        </div>
        <div className="flex p-1 bg-muted rounded-lg">
          <Button
            variant={mode === "pipeline" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("pipeline")}
          >
            <LayoutGrid className="h-4 w-4 ml-1" />
            مسار
          </Button>
          <Button
            variant={mode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("table")}
          >
            <List className="h-4 w-4 ml-1" />
            جدول
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">الطلبات</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {summary?.unassigned ?? 0} غير مسند
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">قديمة</p>
                <p className="text-2xl font-bold">{stats.stale}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">تحتاج متابعة</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">مبيعات</p>
                <p className="text-2xl font-bold">{stats.won}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{stats.conversion}% تحويل</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className={cn(
            "absolute top-0 left-0 right-0 h-1",
            stats.conversion >= 20 ? "bg-emerald-500" : stats.conversion >= 10 ? "bg-amber-500" : "bg-rose-500"
          )} />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">التحويل</p>
                <p className="text-2xl font-bold">{Math.round((summary?.conversionRate ?? 0) * 100)}%</p>
              </div>
              <div className={cn(
                "p-2.5 rounded-xl",
                stats.conversion >= 20 ? "bg-emerald-500/10 text-emerald-600" :
                stats.conversion >= 10 ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600"
              )}>
                <Target className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={ar.searchCustomersOrders}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="ml-2 h-4 w-4" />
            <SelectValue placeholder={ar.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar.all}</SelectItem>
            {ORDER_STATUS_LIST.map((status) => {
              const config = ORDER_STATUS[status];
              return (
                <SelectItem key={status} value={status}>
                  {config.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline / Table View */}
      {mode === "pipeline" ? (
        loading ? (
          <div className="flex gap-4 overflow-x-auto">
            {ORDER_STATUS_LIST.map((status) => (
              <div key={status} className="w-[280px] shrink-0">
                <Skeleton className="h-10 rounded-t-xl" />
                <Skeleton className="h-96 rounded-b-xl rounded-t-none" />
              </div>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
              {ORDER_STATUS_LIST.map((status) => {
                const column = board?.find((b: any) => b.status === status);
                const items = column?.items || [];
                return (
                  <PipelineColumn key={status} status={status} items={items} />
                );
              })}
            </div>

            <DragOverlay>
              {activeOrder ? <StaticOrderCard order={activeOrder} /> : null}
            </DragOverlay>
          </DndContext>
        )
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{ar.noOrdersFound}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => (
            <OrderRow key={order._id} order={order} />
          ))}
        </div>
      )}

      {/* Count */}
      {!loading && mode === "table" && filteredOrders.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          عرض {filteredOrders.length} من {stats.total} طلب
        </p>
      )}
    </div>
  );
}
