"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ar } from "@/lib/ar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  DollarSign,
  Calendar,
  Building2,
  Phone,
  MessageSquare,
  Bot,
  Package,
  Target,
  AlertTriangle,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { toast } from "sonner";
import {
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  type OrderStatus,
} from "@/lib/status-config";

/* ─────────── Inline Info Item ─────────── */
function InfoItem({
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

/* ─────────── Main Page ─────────── */
export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as Id<"orders">;
  const order = useQuery(api.features.admin.api.getOrder, { orderId });
  const updateOrder = useMutation(api.features.admin.api.orderUpdate);

  const [saving, setSaving] = React.useState(false);
  const [assignedTo, setAssignedTo] = React.useState("");
  const [nextAction, setNextAction] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [showAI, setShowAI] = React.useState(false);

  React.useEffect(() => {
    if (!order) return;
    setAssignedTo(order.assignedTo ?? "");
    setNextAction(order.nextAction ?? "");
    setNotes(order.notes ?? "");
  }, [order]);

  async function onSave() {
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

  /* ── Loading ── */
  if (order === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  /* ── Not Found ── */
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
  const isTerminal =
    order.status === "closed_won" || order.status === "closed_lost";

  const hasAISummary =
    order.aiHandoffReason ||
    order.customerNeedsSummary ||
    order.salesTalkingPoints;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title={order.userName || ar.unnamedCustomer}
        description={`طلب #${order._id.slice(-6)}`}
        icon={Package}
        breadcrumbs={[
          { label: ar.orders, href: "/orders" },
          { label: order.userName || ar.unnamedCustomer },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Badge className={cn("border-0", status.bgColor, status.textColor)}>
              <StatusIcon className="h-3 w-3 ml-1" />
              {status.label}
            </Badge>
            {isStale && !isTerminal && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-500/30"
              >
                <AlertTriangle className="h-3 w-3 ml-1" />
                قديم
              </Badge>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/users/${order.userId}?tab=conversation`}>
                <MessageSquare className="h-4 w-4 ml-2" />
                {ar.conversation}
              </Link>
            </Button>
          </div>
        }
      />

      {/* ── Quick Meta ── */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <DollarSign className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {order.budget
              ? `${order.budget.toLocaleString("ar-SA")} ر.س`
              : "-"}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Target className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {(ar as any)[order.type] || order.type}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {new Date(order._creationTime).toLocaleDateString("ar-SA")}
          </span>
        </div>
        {order.priority && (
          <>
            <div className="h-4 w-px bg-border" />
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                order.priority === "high"
                  ? "text-rose-600 border-rose-300"
                  : order.priority === "urgent"
                    ? "text-red-600 border-red-300"
                    : ""
              )}
            >
              {(ar as any)[order.priority] || order.priority}
            </Badge>
          </>
        )}
      </div>

      {/* ── Info Section ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">معلومات العميل</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <InfoItem label={ar.name} value={order.userName || "-"} />
            <InfoItem
              label={ar.phone}
              value={<span dir="ltr">{order.userPhone || "-"}</span>}
            />
            <InfoItem
              label={ar.source}
              value={
                (ar as any)[order.source || ""] || order.source || "-"
              }
            />
            <InfoItem
              label={ar.preferredLocation}
              value={order.preferredLocation || "-"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">الكيانات المرتبطة</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <InfoItem
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
            <InfoItem
              label={ar.bankProduct}
              value={
                order.bankProduct?.name || order.bankProductName || "-"
              }
            />
            <InfoItem
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
          </CardContent>
        </Card>
      </div>

      {/* ── AI Summary (Collapsible) ── */}
      {hasAISummary && (
        <Card>
          <button
            onClick={() => setShowAI(!showAI)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-xl"
          >
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Bot className="h-4 w-4 text-violet-600" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">ملخص المبيعات</p>
                <p className="text-xs text-muted-foreground">
                  توليد تلقائي من الذكاء الاصطناعي
                </p>
              </div>
            </div>
            {showAI ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              showAI ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <CardContent className="space-y-3 pt-0 pb-4">
              {order.aiHandoffReason && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {ar.handoffReason}
                  </p>
                  <p className="text-sm">{order.aiHandoffReason}</p>
                </div>
              )}
              {order.customerNeedsSummary && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {ar.customerNeedsSummary}
                  </p>
                  <p className="text-sm">{order.customerNeedsSummary}</p>
                </div>
              )}
              {order.salesTalkingPoints && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {ar.talkingPoints}
                  </p>
                  <p className="text-sm">{order.salesTalkingPoints}</p>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      )}

      {/* ── Follow-up & Actions ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">المتابعة والإجراءات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {ar.assignedTo}
              </label>
              <Input
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="معرّف مسؤول المبيعات"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {ar.nextAction}
              </label>
              <Input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="اتصال - مستندات - عرض"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {ar.notes}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button onClick={onSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Save className="h-4 w-4 ml-1" />
              )}
              {ar.save}
            </Button>

            {transitions.length > 0 && (
              <div className="flex items-center gap-2">
                {transitions.map((next) => {
                  const nextConfig = ORDER_STATUS[next as OrderStatus];
                  const NextIcon = nextConfig?.icon;
                  return (
                    <Button
                      key={next}
                      variant="outline"
                      size="sm"
                      onClick={() => onMoveStatus(next)}
                      disabled={saving}
                      className={cn("gap-1.5", nextConfig?.textColor)}
                    >
                      {NextIcon && <NextIcon className="h-3.5 w-3.5" />}
                      {nextConfig?.label || next}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
