"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Upload, X } from "lucide-react";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { PendingAction, PendingMedia } from "./types";

function statusLabel(status: PendingAction["status"]): string {
  if (status === "pending") return "معلق";
  if (status === "confirmed") return "تم التأكيد";
  if (status === "cancelled") return "ملغي";
  if (status === "executed") return "تم التنفيذ";
  return "فشل التنفيذ";
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
}) {
  return (
    <div className="agent-actions-scroll">
      {actions.length === 0 ? (
        <div className="agent-card">
          <div className="agent-card-title">لا توجد إجراءات معلقة</div>
          <div className="agent-card-subtle">ستظهر بطاقات الإجراءات هنا عند تجهيز الوكيل لعملية جديدة.</div>
        </div>
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
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(action.editablePayload ?? {}, null, 2)
  );
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
    setPayloadText(JSON.stringify(action.editablePayload ?? {}, null, 2));
  }, [action._id, action.editablePayload]);

  const canUploadMedia =
    action.status === "pending" &&
    (action.entityType === "property" || action.entityType === "bank" || action.entityType === "partner");

  const parsePayload = useCallback(() => {
    try {
      return JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      throw new Error("تنسيق JSON غير صالح");
    }
  }, [payloadText]);

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
      alert(error instanceof Error ? error.message : "فشل رفع الملفات");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="agent-card">
      <div className="agent-card-title">{action.actionType}</div>
      <div className="agent-card-subtle">
        {action.entityType} - {statusLabel(action.status)}
      </div>
      <div className="agent-card-body">
        <textarea
          className="agent-textarea"
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          disabled={action.status !== "pending"}
        />
        {action.status === "pending" ? (
          <button
            className="agent-btn"
            onClick={async () => {
              try {
                await updatePayload(action._id, parsePayload());
              } catch (error) {
                alert(error instanceof Error ? error.message : "فشل حفظ التعديلات");
              }
            }}
          >
            حفظ التعديلات
          </button>
        ) : null}

        {action.status === "pending" ? (
          <button
            className="agent-btn"
            disabled={isRewriting}
            onClick={async () => {
              try {
                setIsRewriting(true);
                const payload = parsePayload();
                const target = pickRewritableField(payload);
                if (!target) {
                  alert("لا يوجد حقل نصي مناسب لإعادة الصياغة.");
                  return;
                }
                const rewritten = await rewriteText("rewrite", target.value);
                setRewritePreview({
                  field: target.field,
                  original: target.value,
                  rewritten,
                });
              } catch (error) {
                alert(error instanceof Error ? error.message : "فشل تحسين الصياغة");
              } finally {
                setIsRewriting(false);
              }
            }}
          >
            {isRewriting ? "جاري التحسين..." : "تحسين الصياغة بالذكاء الاصطناعي"}
          </button>
        ) : null}

        {rewritePreview ? (
          <div className="agent-rewrite-preview" dir="rtl">
            <div className="agent-card-subtle">معاينة التعديل ({rewritePreview.field})</div>
            <div className="agent-rewrite-preview-text">{rewritePreview.rewritten}</div>
            <div className="agent-inline-row">
              <button
                className="agent-btn primary"
                onClick={() => {
                  try {
                    const payload = parsePayload();
                    payload[rewritePreview.field] = rewritePreview.rewritten;
                    setPayloadText(JSON.stringify(payload, null, 2));
                    setRewritePreview(null);
                  } catch (error) {
                    alert(error instanceof Error ? error.message : "فشل تطبيق التعديل");
                  }
                }}
              >
                تطبيق
              </button>
              <button className="agent-btn ghost" onClick={() => setRewritePreview(null)}>
                إلغاء
              </button>
            </div>
          </div>
        ) : null}

        {canUploadMedia ? (
          <>
            <label className="agent-btn" style={{ justifyContent: "flex-start", cursor: isUploading ? "wait" : "pointer" }}>
              <Upload size={14} />
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

            {mediaItems.map((item, index) => (
              <div key={item._id} className="agent-media-item">
                {item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="uploaded" className="agent-media-thumb" />
                ) : (
                  <div className="agent-media-thumb" />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="agent-card-subtle" style={{ wordBreak: "break-all" }}>
                    {item.storageId}
                  </div>
                  <div className="agent-card-subtle">
                    {item.isPrimary ? "الصورة الأساسية" : `الترتيب ${item.sortOrder + 1}`}
                  </div>
                </div>
                <button className="agent-btn icon ghost" onClick={() => void moveMedia(index, -1)}>
                  <ArrowUp size={14} />
                </button>
                <button className="agent-btn icon ghost" onClick={() => void moveMedia(index, 1)}>
                  <ArrowDown size={14} />
                </button>
                <button className="agent-btn icon ghost" onClick={() => void removeMedia(item._id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </>
        ) : null}

        {action.status === "pending" ? (
          <div className="agent-inline-row">
            <button
              className="agent-btn primary"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await confirmAction(action._id, parsePayload());
                } catch (error) {
                  alert(error instanceof Error ? error.message : "فشل التأكيد");
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              تأكيد
            </button>
            <button
              className="agent-btn ghost"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await cancelAction(action._id);
                } catch (error) {
                  alert(error instanceof Error ? error.message : "فشل الإلغاء");
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              إلغاء
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
