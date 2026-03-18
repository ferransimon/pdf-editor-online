"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

interface ClonePageModalProps {
  pdfDoc: PDFDocumentProxy;
  pageCount: number;
  sourcePage: number; // 0-based
  onConfirm: (pages: number[]) => void;
  onClose: () => void;
}

export function ClonePageModal({
  pdfDoc,
  pageCount,
  sourcePage,
  onConfirm,
  onClose,
}: ClonePageModalProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [thumbnails, setThumbnails] = useState<(string | null)[]>(() =>
    Array.from({ length: pageCount }, () => null)
  );

  // Progressively render thumbnails
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { renderPageToDataUrl } = await import("@/lib/pdf-renderer");
      for (let i = 0; i < pageCount; i++) {
        if (cancelled) return;
        try {
          const url = await renderPageToDataUrl(pdfDoc, i + 1, 0.25);
          if (cancelled) return;
          setThumbnails((prev) => {
            const next = [...prev];
            next[i] = url;
            return next;
          });
        } catch {
          // Skip failed page thumbnails silently
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageCount]);

  const allTargets = Array.from({ length: pageCount }, (_, i) => i).filter(
    (i) => i !== sourcePage
  );

  const allSelected = allTargets.every((i) => selected.has(i));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allTargets));
    }
  };

  const togglePage = (idx: number) => {
    if (idx === sourcePage) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleApply = () => {
    onConfirm(Array.from(selected).sort((a, b) => a - b));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-800">
            {t.annotate.cloneModal.title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Select all / deselect all */}
        <div className="px-5 py-2.5 border-b border-zinc-100 shrink-0">
          <button
            onClick={toggleSelectAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {allSelected
              ? t.annotate.cloneModal.deselectAll
              : t.annotate.cloneModal.selectAll}
          </button>
        </div>

        {/* Thumbnails grid */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
            {Array.from({ length: pageCount }, (_, idx) => {
              const isSource = idx === sourcePage;
              const isSelected = selected.has(idx);
              const thumb = thumbnails[idx];

              return (
                <button
                  key={idx}
                  onClick={() => togglePage(idx)}
                  disabled={isSource}
                  className={[
                    "relative flex flex-col items-center gap-1.5 rounded-lg p-1.5 border-2 transition-all",
                    isSource
                      ? "border-zinc-200 cursor-default opacity-50"
                      : isSelected
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {/* Thumbnail image */}
                  <div className="w-full aspect-3/4 bg-zinc-100 rounded overflow-hidden flex items-center justify-center">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    )}
                  </div>

                  {/* Page label */}
                  <span className="text-[11px] font-medium text-zinc-600 leading-none">
                    {isSource
                      ? `${idx + 1} (${t.annotate.cloneModal.currentPage})`
                      : `${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-zinc-200 shrink-0">
          <span className="text-xs text-zinc-500">
            {t.annotate.cloneModal.selected(selected.size)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t.annotate.cloneModal.cancel}
            </Button>
            <Button size="sm" onClick={handleApply} disabled={selected.size === 0}>
              {t.annotate.cloneModal.apply}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
