"use client";

import { useState, useCallback } from "react";
import { Upload, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openPdfFile, type PdfFile } from "@/lib/file-access";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface UploaderProps {
  onFileLoaded: (file: PdfFile) => void;
  loading?: boolean;
  onBack?: () => void;
  mode?: "split" | "annotate";
}

export function Uploader({ onFileLoaded, loading, onBack, mode = "split" }: UploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
        setError(t.uploader.errorNotPdf);
        return;
      }
      setError(null);
      const bytes = await file.arrayBuffer();
      onFileLoaded({ name: file.name, bytes });
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleOpen = async () => {
    try {
      setError(null);
      const file = await openPdfFile();
      onFileLoaded(file);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(t.uploader.errorOpen);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-500">{t.uploader.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-8 max-w-md w-full px-8">
        {onBack && (
          <button
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.uploader.back}
          </button>
        )}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {mode === "annotate" ? t.uploader.annotateTitle : t.uploader.splitTitle}
          </h1>
          <p className="text-sm text-zinc-400">
            {mode === "annotate" ? t.uploader.annotateSubtitle : t.uploader.splitSubtitle}
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={handleOpen}
          className={cn(
            "w-full rounded-xl border-2 border-dashed p-16 flex flex-col items-center gap-4 transition-colors cursor-pointer",
            dragging
              ? "border-zinc-900 bg-zinc-50"
              : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
          )}
        >
          <div className="rounded-full bg-zinc-100 p-4">
            <Upload className="h-6 w-6 text-zinc-500" />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {t.uploader.dragHere}
            </p>
            <p className="text-xs text-zinc-400">{t.uploader.dragOr}</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <Button onClick={handleOpen} variant="outline" className="w-full">
          {t.uploader.select}
        </Button>
      </div>
    </div>
  );
}
