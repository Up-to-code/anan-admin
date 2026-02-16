"use client";

import { useCallback, useEffect, useState } from "react";
import { ar } from "@/lib/ar";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import type { PendingAction, PendingMedia } from "./types";

export function ActionCard({ action }: { action: PendingAction }) {
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(action.editablePayload ?? {}, null, 2)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setPayloadText(JSON.stringify(action.editablePayload ?? {}, null, 2));
  }, [action._id, action.editablePayload]);

  const media = useQuery(api.features.admin.agentActions.listPendingActionMedia, {
    actionId: action._id,
  }) as PendingMedia[] | undefined;
  const updatePayload = useMutation(api.features.admin.agentActions.updatePendingActionPayload);
  const confirmPendingAction = useMutation(api.features.admin.agentActions.confirmPendingAction);
  const cancelPendingAction = useMutation(api.features.admin.agentActions.cancelPendingAction);
  const generateUploadUrl = useMutation(
    api.features.admin.agentActions.generatePendingActionUploadUrl
  );
  const attachPendingMedia = useMutation(api.features.admin.agentActions.attachPendingActionMedia);
  const removePendingMedia = useMutation(api.features.admin.agentActions.removePendingActionMedia);
  const reorderPendingMedia = useMutation(api.features.admin.agentActions.reorderPendingActionMedia);

  const canUploadMedia =
    action.status === "pending" &&
    (action.entityType === "property" || action.entityType === "bank" || action.entityType === "partner");

  const parsePayload = useCallback(() => {
    try {
      return JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      throw new Error(ar.payloadInvalid);
    }
  }, [payloadText]);

  const handleSaveDraft = useCallback(async () => {
    try {
      const payload = parsePayload();
      await updatePayload({ actionId: action._id, payload });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : ar.failedToUpdatePayload);
    }
  }, [parsePayload, updatePayload, action._id]);

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const payload = parsePayload();
      await confirmPendingAction({ actionId: action._id, editedPayload: payload });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : ar.failedToConfirmAction);
    } finally {
      setIsSubmitting(false);
    }
  }, [parsePayload, confirmPendingAction, action._id]);

  const handleCancel = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await cancelPendingAction({ actionId: action._id });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : ar.failedToCancelAction);
    } finally {
      setIsSubmitting(false);
    }
  }, [cancelPendingAction, action._id]);

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setIsUploading(true);
      try {
        for (const file of Array.from(files)) {
          const uploadUrl = await generateUploadUrl({ actionId: action._id });
          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });
          if (!uploadRes.ok) {
            throw new Error(`Upload failed for ${file.name}`);
          }
          const json = (await uploadRes.json()) as { storageId?: Id<"_storage"> };
          if (!json.storageId) {
            throw new Error(`Upload did not return storageId for ${file.name}`);
          }
          await attachPendingMedia({
            actionId: action._id,
            storageId: json.storageId,
            kind: action.entityType === "property" ? "image" : "logo",
          });
        }
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : ar.failedToUploadMedia);
      } finally {
        setIsUploading(false);
      }
    },
    [generateUploadUrl, attachPendingMedia, action._id, action.entityType]
  );

  const moveMedia = useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!media) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= media.length) return;
      const ids = media.map((item) => item._id);
      const tmp = ids[index];
      ids[index] = ids[nextIndex];
      ids[nextIndex] = tmp;
      await reorderPendingMedia({ actionId: action._id, mediaIds: ids });
    },
    [media, reorderPendingMedia, action._id]
  );

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            Pending `{action.actionType}` ({action.entityType})
          </p>
          <p className="text-xs text-muted-foreground">{ar.status}: {action.status}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{ar.editableDetails}</p>
        <Textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          className="min-h-[180px] font-mono text-xs"
          disabled={action.status !== "pending"}
        />
        {action.status === "pending" ? (
          <Button type="button" variant="outline" size="sm" onClick={handleSaveDraft}>
            {ar.saveEdits}
          </Button>
        ) : null}
      </div>

      {canUploadMedia ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{ar.uploadModule}</p>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {isUploading ? ar.uploading : ar.uploadFiles}
              <input
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={(e) => void handleUploadFiles(e.target.files)}
                disabled={isUploading}
              />
            </label>
          </div>

          <div className="space-y-2">
            {(media ?? []).map((item, index) => (
              <div key={item._id} className="flex items-center gap-2 rounded border p-2">
                {item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="uploaded" className="h-14 w-14 rounded object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{item.storageId}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.isPrimary ? ar.primary : ar.orderN.replace("{n}", String(item.sortOrder + 1))}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void moveMedia(index, -1)}
                  disabled={index === 0 || action.status !== "pending"}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void moveMedia(index, 1)}
                  disabled={index === (media?.length ?? 0) - 1 || action.status !== "pending"}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void removePendingMedia({ mediaId: item._id })}
                  disabled={action.status !== "pending"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {action.status === "pending" ? (
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => void handleConfirm()} disabled={isSubmitting}>
            {ar.confirm}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCancel()}
            disabled={isSubmitting}
          >
            {ar.cancel}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {action.status === "executed"
            ? ar.actionExecuted
            : action.status === "failed"
              ? ar.executionFailedDesc
              : ar.actionClosed}
        </p>
      )}
    </div>
  );
}
