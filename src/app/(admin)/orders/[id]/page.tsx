"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ar } from "@/lib/ar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  User,
  DollarSign,
  Calendar,
  Building2,
  Phone,
  Clock,
  MessageSquare,
  ArrowRight,
  Bot,
  Home,
  Landmark,
  Package,
  Target,
  Activity,
  CheckCircle,
  AlertTriangle,
  Save,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  type OrderStatus,
} from "@/lib/status-config";

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as Id<"orders">;
  const order = useQuery(api.features.admin.api.getOrder, { orderId });
  const updateOrder = useMutation(api.features.admin.api.orderUpdate);

  const [saving, setSaving] = React.useState(false);
  const [assignedTo, setAssignedTo] = React.useState("");
  const [nextAction, setNextAction] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!order) return;
    setAssignedTo(order.assignedTo ?? "");
    setNextAction(order.nextAction ?? "");
    setNotes(order.notes ?? "");
  }, [order]);

  async function onSaveDetails() {
    if (!order) return;
    setSaving(true);
    try {
      await updateOrder({
        id: order._id,
        assignedTo: assignedTo || undefined,
        nextAction: nextAction || undefined,
        notes: notes || undefined,
      });
      toast.success("تم الحفظ");
    } catch {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function onMoveStatus(status: string) {
    if (!order) return;
    setSaving(true);
    try {
      await updateOrder({ id: order._id, status: status as any });
      toast.success("تم تحديث الحالة");
    } catch {
      toast.error("فشل التحديث");
    } finally {
      setSaving(false);
    }
  }

  if (order === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            {ar.orderNotFound}
          </p>
          <Button asChild className="mt-4">
            <Link href="/orders">{ar.back}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status =
    ORDER_STATUS[order.status as OrderStatus] || ORDER_STATUS.new_lead;
  const StatusIcon = status.icon;
  const transitions = ORDER_TRANSITIONS[order.status] || [];

  const isStale = order.ageHours > 48;
  const isWon = order.status === "closed_won";
  const isLost = order.status === "closed_lost";

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">{ar.dashboard}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/orders">{ar.orders}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              طلب #{order._id.slice(-6)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="relative overflow-hidden">
        <div className={cn("h-1", status.bgColor)} />
        <CardContent className="pt-6 pb-4">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className={cn("p-4 rounded-xl", status.bgColor)}>
                <StatusIcon className={cn("h-8 w-8", status.textColor)} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold">
                    {order.userName || ar.unnamedCustomer}
                  </h1>
                  <Badge
                    className={cn(
                      status.bgColor,
                      status.textColor,
                      "border-0 text-xs",
                    )}
                  >
                    {status.label}
                  </Badge>
                  {isStale && !isWon && !isLost && (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-500/30"
                    >
                      <AlertTriangle className="h-3 w-3 ml-1" />
                      قديم
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Phone className="h-4 w-4" />
                    <span dir="ltr">{order.userPhone || "-"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>{order.ageHours} ساعة</span>
                  </div>
                </div>
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/users/${order.userId}?tab=conversation`}>
                      <MessageSquare className="h-4 w-4 ml-2" />
                      {ar.conversation}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ar.budget}</p>
                <p className="text-lg font-bold">
                  {order.budget
                    ? `${order.budget.toLocaleString("ar-SA")} ر.س`
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Target className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ar.type}</p>
                <p className="text-lg font-bold">
                  {(ar as any)[order.type] || order.type}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-1",
              order.priority === "high"
                ? "bg-rose-500"
                : order.priority === "low"
                  ? "bg-gray-400"
                  : "bg-amber-500",
            )}
          />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl",
                  order.priority === "high"
                    ? "bg-rose-500/10"
                    : order.priority === "low"
                      ? "bg-gray-500/10"
                      : "bg-amber-500/10",
                )}
              >
                <Activity
                  className={cn(
                    "h-4 w-4",
                    order.priority === "high"
                      ? "text-rose-600"
                      : order.priority === "low"
                        ? "text-gray-600"
                        : "text-amber-600",
                  )}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ar.priority}</p>
                <p className="text-lg font-bold">
                  {(ar as any)[order.priority || "medium"] || order.priority}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-violet-500" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <Calendar className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ar.createdAt}</p>
                <p className="text-sm font-bold">
                  {new Date(order._creationTime).toLocaleDateString("ar-SA")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <InfoCard title="معلومات العميل" icon={User}>
          <div className="space-y-0">
            <InfoRow label={ar.name} value={order.userName || "-"} />
            <InfoRow
              label={ar.phone}
              value={<span dir="ltr">{order.userPhone || "-"}</span>}
            />
            <InfoRow
              label={ar.source}
              value={(ar as any)[order.source || ""] || order.source || "-"}
            />
            <InfoRow
              label={ar.preferredLocation}
              value={order.preferredLocation || "-"}
            />
          </div>
        </InfoCard>

        <InfoCard title="الكيانات المرتبطة" icon={Building2}>
          <div className="space-y-0">
            <InfoRow
              label={ar.bank}
              value={
                order.bank ? (
                  <Link
                    href={`/banks/${order.bank._id}`}
                    className="hover:text-primary"
                  >
                    {order.bank.name}
                  </Link>
                ) : (
                  order.bankName || "-"
                )
              }
            />
            <InfoRow
              label={ar.bankProduct}
              value={order.bankProduct?.name || order.bankProductName || "-"}
            />
            <InfoRow
              label={ar.property}
              value={
                order.property ? (
                  <Link
                    href={`/properties/${order.property._id}`}
                    className="hover:text-primary"
                  >
                    {order.property.title}
                  </Link>
                ) : (
                  order.propertyTitle || "-"
                )
              }
            />
          </div>
        </InfoCard>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Bot className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base">ملخص المبيعات</CardTitle>
              <CardDescription>
                توليد تلقائي من الذكاء الاصطناعي
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">
              {ar.handoffReason}
            </p>
            <p className="text-sm">
              {order.aiHandoffReason || order.intent || "-"}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">
              {ar.customerNeedsSummary}
            </p>
            <p className="text-sm">{order.customerNeedsSummary || "-"}</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">
              {ar.talkingPoints}
            </p>
            <p className="text-sm">{order.salesTalkingPoints || "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">المتابعة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{ar.assignedTo}</label>
              <Input
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="معرّف مسؤول المبيعات"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{ar.nextAction}</label>
              <Input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="اتصال - مستندات - عرض"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{ar.notes}</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={onSaveDetails} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {ar.save}
          </Button>
        </CardContent>
      </Card>

      {transitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">نقل إلى المرحلة التالية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {transitions.map((next) => {
                const nextConfig = ORDER_STATUS[next as OrderStatus];
                return (
                  <Button
                    key={next}
                    variant="outline"
                    onClick={() => onMoveStatus(next)}
                    disabled={saving}
                    className={cn("gap-2", nextConfig?.textColor)}
                  >
                    {nextConfig?.icon && (
                      <nextConfig.icon className="h-4 w-4" />
                    )}
                    {nextConfig?.label || next}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
