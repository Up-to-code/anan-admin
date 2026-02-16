"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, GripVertical, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploaderProps {
  entityId?: string;
  entityType?: "property" | "bank" | "partner";
  pendingActionId?: Id<"adminPendingActions">;
  images: Array<{
    id?: string;
    storageId?: string;
    url?: string;
    isPrimary?: boolean;
    caption?: string;
  }>;
  onImagesChange: (
    images: Array<{
      storageId?: string;
      url?: string;
      isPrimary?: boolean;
      caption?: string;
    }>,
  ) => void;
  maxImages?: number;
  kind?: "image" | "logo";
}

export function ImageUploader({
  entityId,
  entityType,
  pendingActionId,
  images,
  onImagesChange,
  maxImages = 10,
  kind = "image",
}: ImageUploaderProps) {
  const [uploading, setUploading] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.services.storage.generateUploadUrl);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast.error(`الحد الأقصى ${maxImages} صور`);
      return;
    }

    const filesToUpload = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      toast.error("يرجى اختيار صور صالحة");
      return;
    }

    setUploading(true);
    try {
      const newImages: Array<{
        storageId: string;
        url: string;
        isPrimary: boolean;
        caption?: string;
      }> = [];

      for (const file of filesToUpload) {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        const url = URL.createObjectURL(file);
        newImages.push({
          storageId,
          url,
          isPrimary: images.length === 0 && newImages.length === 0,
        });
      }

      onImagesChange([...images, ...newImages]);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("فشل رفع الصور");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    if (images[index]?.isPrimary && newImages.length > 0) {
      newImages[0].isPrimary = true;
    }
    onImagesChange(newImages);
  };

  const setPrimary = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onImagesChange(newImages);
  };

  const handleImageDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleImageDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          "hover:border-primary/50 hover:bg-muted/30",
          uploading && "opacity-50 pointer-events-none",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">جاري الرفع...</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              اسحب الصور هنا أو انقر للاختيار
            </p>
            <p className="text-xs text-muted-foreground">
              الحد الأقصى {maxImages} صور ({images.length}/{maxImages})
            </p>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image, index) => (
            <div
              key={image.storageId || image.id || index}
              draggable
              onDragStart={() => handleImageDragStart(index)}
              onDragOver={(e) => handleImageDragOver(e, index)}
              onDragEnd={handleImageDragEnd}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden border-2 group cursor-move",
                image.isPrimary
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-transparent",
                draggedIndex === index && "opacity-50",
              )}
            >
              <img
                src={image.url || `/api/storage/${image.storageId}`}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPrimary(index);
                  }}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute top-1 right-1">
                <GripVertical className="h-4 w-4 text-white/70" />
              </div>
              {image.isPrimary && (
                <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-xs py-1 text-center">
                  رئيسية
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
