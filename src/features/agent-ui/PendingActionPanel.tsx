"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PendingAction, PendingMedia } from "./types";

function statusLabel(status: PendingAction["status"]): string {
  if (status === "pending") return "معلق";
  if (status === "confirmed") return "تم التأكيد";
  if (status === "cancelled") return "ملغي";
  if (status === "executed") return "تم التنفيذ";
  return "فشل التنفيذ";
}

function getStatusColor(status: PendingAction["status"]) {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "confirmed": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "executed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "cancelled": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    case "failed": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

type DraftField = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

const REQUIRED_KEYS_BY_ACTION: Record<string, string[]> = {
  createProperty: ["title", "price", "location"],
  createBank: ["name", "slug", "status"],
  createDeveloper: ["name", "slug", "status"],
  createBankProduct: ["bankId", "name", "type"],
};

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function getDraftFields(actionType: string): DraftField[] {
  if (actionType === "createProperty") {
    return [
      { key: "title", label: "العنوان", type: "text" },
      { key: "address", label: "العنوان الكامل", type: "text" },
      { key: "price", label: "السعر", type: "number" },
      { key: "beds", label: "غرف النوم", type: "number" },
      { key: "baths", label: "الحمامات", type: "number" },
      { key: "location", label: "المدينة", type: "text" },
      { key: "area", label: "الحي/المنطقة", type: "text" },
      { key: "sqft", label: "المساحة (قدم)", type: "number" },
      {
        key: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "available", label: "متاح" },
          { value: "reserved", label: "محجوز" },
          { value: "sold", label: "مباع" },
        ],
      },
      { key: "description", label: "الوصف", type: "textarea" },
    ];
  }

  if (actionType === "createBank") {
    return [
      { key: "name", label: "اسم البنك", type: "text" },
      { key: "slug", label: "المعرف (slug)", type: "text" },
      { key: "contactEmail", label: "البريد الإلكتروني", type: "text" },
      {
        key: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "active", label: "نشط" },
          { value: "inactive", label: "غير نشط" },
          { value: "suspended", label: "معلّق" },
        ],
      },
      { key: "description", label: "الوصف", type: "textarea" },
    ];
  }

  if (actionType === "createDeveloper") {
    return [
      { key: "name", label: "اسم المطور", type: "text" },
      { key: "slug", label: "المعرف (slug)", type: "text" },
      { key: "contactEmail", label: "البريد الإلكتروني", type: "text" },
      { key: "phone", label: "رقم الجوال", type: "text" },
      { key: "website", label: "الموقع", type: "text" },
      {
        key: "status",
        label: "الحالة",
        type: "select",
        options: [
          { value: "pending", label: "بانتظار التفعيل" },
          { value: "active", label: "نشط" },
        ],
      },
      { key: "description", label: "الوصف", type: "textarea" },
    ];
  }

  if (actionType === "createBankProduct") {
    return [
      { key: "bankId", label: "معرف البنك", type: "text" },
      { key: "name", label: "اسم المنتج", type: "text" },
      { key: "type", label: "النوع", type: "text" },
      { key: "description", label: "الوصف", type: "textarea" },
    ];
  }

  return [];
}

export function PendingActionPanel({
  actions,
  updatePayload,
  confirmAction,
  rewriteText,
  cancelAction,
  generateUploadUrl,
  attachMedia,
  removeMedia,
  reorderMedia,
  compact = false,
  hideEmptyState = false,
  className,
}: {
  actions: PendingAction[];
  updatePayload: (actionId: Id<"adminPendingActions">, payload: unknown) => Promise<void>;
  confirmAction: (actionId: Id<"adminPendingActions">, payload?: unknown) => Promise<void>;
  rewriteText: (mode: "rewrite" | "formal" | "summarize", text: string) => Promise<string>;
  cancelAction: (actionId: Id<"adminPendingActions">) => Promise<void>;
  generateUploadUrl: (actionId: Id<"adminPendingActions">) => Promise<string>;
  attachMedia: (
    actionId: Id<"adminPendingActions">,
    storageId: Id<"_storage">,
    kind: "image" | "logo"
  ) => Promise<void>;
  removeMedia: (mediaId: Id<"entityMedia">) => Promise<void>;
  reorderMedia: (actionId: Id<"adminPendingActions">, mediaIds: Id<"entityMedia">[]) => Promise<void>;
  compact?: boolean;
  hideEmptyState?: boolean;
  className?: string;
}) {
  if (hideEmptyState && actions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        compact ? "space-y-3" : "h-full overflow-y-auto p-4 space-y-4",
        className
      )}
    >
      {actions.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <CardContent className="space-y-3 pt-6">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Loader2 size={24} className="text-muted-foreground animate-spin-slow" />
            </div>
            <p className="font-medium text-foreground">لا توجد إجراءات معلقة</p>
            <p className="text-sm text-muted-foreground">ستظهر بطاقات الإجراءات هنا عند تجهيز الوكيل لعملية جديدة.</p>
          </CardContent>
        </Card>
      ) : (
        actions.map((action) => (
          <PendingActionItem
            key={action._id}
            action={action}
            updatePayload={updatePayload}
            confirmAction={confirmAction}
            rewriteText={rewriteText}
            cancelAction={cancelAction}
            generateUploadUrl={generateUploadUrl}
            attachMedia={attachMedia}
            removeMedia={removeMedia}
            reorderMedia={reorderMedia}
          />
        ))
      )}
    </div>
  );
}

function PendingActionItem({
  action,
  updatePayload,
  confirmAction,
  rewriteText,
  cancelAction,
  generateUploadUrl,
  attachMedia,
  removeMedia,
  reorderMedia,
}: {
  action: PendingAction;
  updatePayload: (actionId: Id<"adminPendingActions">, payload: unknown) => Promise<void>;
  confirmAction: (actionId: Id<"adminPendingActions">, payload?: unknown) => Promise<void>;
  rewriteText: (mode: "rewrite" | "formal" | "summarize", text: string) => Promise<string>;
  cancelAction: (actionId: Id<"adminPendingActions">) => Promise<void>;
  generateUploadUrl: (actionId: Id<"adminPendingActions">) => Promise<string>;
  attachMedia: (
    actionId: Id<"adminPendingActions">,
    storageId: Id<"_storage">,
    kind: "image" | "logo"
  ) => Promise<void>;
  removeMedia: (mediaId: Id<"entityMedia">) => Promise<void>;
  reorderMedia: (actionId: Id<"adminPendingActions">, mediaIds: Id<"entityMedia">[]) => Promise<void>;
}) {
  const [payloadDraft, setPayloadDraft] = useState<Record<string, unknown>>(
    typeof action.editablePayload === "object" && action.editablePayload
      ? (action.editablePayload as Record<string, unknown>)
      : {}
  );
  const [payloadText, setPayloadText] = useState(JSON.stringify(payloadDraft, null, 2));
  const [advancedMode, setAdvancedMode] = useState(false);
  const media = useQuery(api.features.admin.agentActions.listPendingActionMedia, {
    actionId: action._id,
  }) as PendingMedia[] | undefined;
  const mediaItems = media ?? [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritePreview, setRewritePreview] = useState<{
    field: string;
    original: string;
    rewritten: string;
  } | null>(null);

  useEffect(() => {
    const nextDraft =
      typeof action.editablePayload === "object" && action.editablePayload
        ? (action.editablePayload as Record<string, unknown>)
        : {};
    setPayloadDraft(nextDraft);
    setPayloadText(JSON.stringify(nextDraft, null, 2));
    setAdvancedMode(false);
  }, [action._id, action.editablePayload]);

  const draftFields = useMemo(() => {
    const predefined = getDraftFields(action.actionType);
    if (predefined.length > 0) return predefined;

    const inferred: DraftField[] = [];
    for (const [key, value] of Object.entries(payloadDraft)) {
      if (value == null) {
        inferred.push({ key, label: key, type: "text" });
        continue;
      }
      if (typeof value === "number") {
        inferred.push({ key, label: key, type: "number" });
        continue;
      }
      if (typeof value === "boolean") {
        inferred.push({
          key,
          label: key,
          type: "select",
          options: [
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ],
        });
        continue;
      }
      if (typeof value === "string") {
        inferred.push({
          key,
          label: key,
          type:
            value.length > 80 ||
            key.includes("description") ||
            key.includes("summary") ||
            key.includes("content")
              ? "textarea"
              : "text",
        });
      }
    }
    return inferred;
  }, [action.actionType, payloadDraft]);
  const hasStructuredForm = draftFields.length > 0;
  const requiredKeys = REQUIRED_KEYS_BY_ACTION[action.actionType] ?? [];
  const missingRequiredFields = draftFields.filter(
    (field) =>
      requiredKeys.includes(field.key) && !hasMeaningfulValue(payloadDraft[field.key]),
  );
  const isConfirmBlocked = action.status === "pending" && missingRequiredFields.length > 0;

  const canUploadMedia =
    action.status === "pending" &&
    (action.entityType === "property" || action.entityType === "bank" || action.entityType === "partner");

  const updateDraftField = useCallback((key: string, value: unknown) => {
    setPayloadDraft((prev) => {
      const next = { ...prev, [key]: value };
      setPayloadText(JSON.stringify(next, null, 2));
      return next;
    });
  }, []);

  const parsePayload = useCallback(() => {
    if (!advancedMode) {
      return payloadDraft;
    }
    try {
      const parsed = JSON.parse(payloadText) as Record<string, unknown>;
      setPayloadDraft(parsed);
      return parsed;
    } catch {
      throw new Error("تنسيق JSON غير صالح");
    }
  }, [advancedMode, payloadDraft, payloadText]);

  const pickRewritableField = (
    payload: Record<string, unknown>
  ): { field: string; value: string } | null => {
    const preferred = ["description", "details", "summary", "content", "notes"];
    for (const field of preferred) {
      const value = payload[field];
      if (typeof value === "string" && value.trim().length >= 20) {
        return { field, value: value.trim() };
      }
    }
    for (const [field, value] of Object.entries(payload)) {
      if (typeof value === "string" && value.trim().length >= 20) {
        return { field, value: value.trim() };
      }
    }
    return null;
  };

  const moveMedia = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= mediaItems.length) return;
    const ids = mediaItems.map((item) => item._id);
    const tmp = ids[index];
    ids[index] = ids[nextIndex];
    ids[nextIndex] = tmp;
    await reorderMedia(action._id, ids);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl(action._id);
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`فشل رفع الملف: ${file.name}`);
        const json = (await uploadRes.json()) as { storageId?: Id<"_storage"> };
        if (!json.storageId) throw new Error("تعذر الحصول على storageId من نتيجة الرفع");
        await attachMedia(action._id, json.storageId, action.entityType === "property" ? "image" : "logo");
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : ar.uploadMediaFailed);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{action.actionType}</CardTitle>
          <Badge variant="outline" className={cn("font-normal border-0", getStatusColor(action.status))}>
            {statusLabel(action.status)}
          </Badge>
        </div>
        <CardDescription>{action.entityType}</CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {hasStructuredForm ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {advancedMode ? "وضع JSON المتقدم" : "وضع الحقول المرئية"}
            </p>
            <Button
              size="sm"
              variant="ghost"
              disabled={action.status !== "pending"}
              onClick={() => setAdvancedMode((v) => !v)}
            >
              {advancedMode ? "الرجوع للحقول" : "عرض JSON"}
            </Button>
          </div>
        ) : null}

        {!advancedMode && hasStructuredForm ? (
          <div className="space-y-3">
            {missingRequiredFields.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  الحقول المطلوبة قبل التأكيد
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {missingRequiredFields.map((field) => (
                    <Badge key={field.key} variant="outline" className="text-[11px]">
                      {field.label}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {draftFields.map((field) => {
              const value = payloadDraft[field.key];
              const textValue =
                typeof value === "string" || typeof value === "number"
                  ? String(value)
                  : "";

              if (field.type === "textarea") {
                return (
                  <div key={field.key} className="space-y-1 md:col-span-2">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <Textarea
                      className="min-h-[100px]"
                      value={textValue}
                      onChange={(e) => updateDraftField(field.key, e.target.value)}
                      disabled={action.status !== "pending"}
                    />
                  </div>
                );
              }

              if (field.type === "select") {
                const hasBooleanOptions = (field.options ?? []).some(
                  (opt) => opt.value === "true" || opt.value === "false"
                );
                return (
                  <div key={field.key} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={textValue}
                      onChange={(e) =>
                        updateDraftField(
                          field.key,
                          hasBooleanOptions ? e.target.value === "true" : e.target.value
                        )
                      }
                      disabled={action.status !== "pending"}
                    >
                      <option value="">اختر</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div key={field.key} className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {field.label}
                    {requiredKeys.includes(field.key) ? " *" : ""}
                  </p>
                  <Input
                    type={field.type === "number" ? "number" : "text"}
                    value={textValue}
                    placeholder={field.placeholder}
                    onChange={(e) =>
                      updateDraftField(
                        field.key,
                        field.type === "number"
                          ? e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                          : e.target.value
                      )
                    }
                    disabled={action.status !== "pending"}
                  />
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          <Textarea
            className="font-mono text-sm min-h-[120px] bg-background"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            disabled={action.status !== "pending"}
          />
        )}

        {action.status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await updatePayload(action._id, parsePayload());
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : ar.saveEditsFailed);
                }
              }}
            >
              حفظ التعديلات
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={isRewriting}
              onClick={async () => {
                try {
                  setIsRewriting(true);
                  const payload = parsePayload();
                  const target = pickRewritableField(payload);
                  if (!target) {
                    toast.error(ar.noRewritableField);
                    return;
                  }
                  const rewritten = await rewriteText("rewrite", target.value);
                  setRewritePreview({
                    field: target.field,
                    original: target.value,
                    rewritten,
                  });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : ar.improveTextFailed);
                } finally {
                  setIsRewriting(false);
                }
              }}
            >
              {isRewriting ? <Loader2 size={14} className="animate-spin ml-2" /> : null}
              {isRewriting ? "جاري التحسين..." : "تحسين الصياغة AI"}
            </Button>
          </div>
        )}

        {rewritePreview && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3" dir="rtl">
            <div className="text-sm font-medium text-muted-foreground">معاينة التعديل ({rewritePreview.field})</div>
            <div className="text-sm p-3 bg-background rounded-md border border-border leading-relaxed">{rewritePreview.rewritten}</div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  try {
                    const payload = parsePayload();
                    payload[rewritePreview.field] = rewritePreview.rewritten;
                    setPayloadDraft(payload);
                    setPayloadText(JSON.stringify(payload, null, 2));
                    setRewritePreview(null);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : ar.applyEditFailed);
                  }
                }}
              >
                تطبيق
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRewritePreview(null)}>
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {canUploadMedia && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">الوسائط</span>
              <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 px-3 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <Upload size={14} className="ml-2" />
                {isUploading ? "جاري الرفع..." : "رفع ملفات"}
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*"
                  onChange={(e) => void uploadFiles(e.target.files)}
                  disabled={isUploading}
                />
              </label>
            </div>

            {mediaItems.length > 0 && (
              <div className="space-y-2">
                {mediaItems.map((item, index) => (
                  <div key={item._id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-background">
                    {item.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="uploaded" className="h-10 w-10 rounded object-cover border border-border" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted animate-pulse" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {item.storageId}
                      </div>
                      <div className="text-xs font-medium">
                        {item.isPrimary ? <Badge variant="secondary" className="text-[10px] h-5 px-1.5">أساسية</Badge> : `ترتيب ${item.sortOrder + 1}`}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void moveMedia(index, -1)}>
                        <ArrowUp size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void moveMedia(index, 1)}>
                        <ArrowDown size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => void removeMedia(item._id)}>
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {action.status === "pending" && (
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              disabled={isSubmitting || isConfirmBlocked}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await confirmAction(action._id, parsePayload());
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : ar.confirmActionFailed);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              تأكيد
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await cancelAction(action._id);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : ar.cancelActionFailed);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              إلغاء
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
