"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Section {
  start: number;
  end: number;
}

interface SectionPreviewProps {
  pdfDoc: PDFDocumentProxy | null;
  thumbnails: string[];
  section: Section | null;
  sectionName: string;
}

export function SectionPreview({
  pdfDoc,
  thumbnails,
  section,
  sectionName,
}: SectionPreviewProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!pdfDoc || !section) {
      setPreviewUrls([]);
      return;
    }

    // Show low-res thumbnails immediately while high-res renders
    setPreviewUrls(thumbnails.slice(section.start, section.end + 1));

    let cancelled = false;
    (async () => {
      const { renderPageToDataUrl } = await import("@/lib/pdf-renderer");
      const urls: string[] = [];
      for (let i = section.start; i <= section.end; i++) {
        if (cancelled) break;
        const url = await renderPageToDataUrl(pdfDoc, i + 1, 1.5);
        if (!cancelled) {
          urls.push(url);
          setPreviewUrls([...urls, ...new Array(section.end - i).fill("")]);
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, section?.start, section?.end]);

  if (!section) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-400">Selecciona una sección</p>
      </div>
    );
  }

  const pageLabel =
    section.start === section.end
      ? `Página ${section.start + 1}`
      : `Páginas ${section.start + 1}–${section.end + 1}`;

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-zinc-50">
      <div className="px-6 py-3 border-b border-zinc-200 bg-white flex items-center gap-3 shrink-0">
        <p className="text-sm font-medium text-zinc-900 truncate">
          {sectionName}
        </p>
        <span className="text-xs text-zinc-400 shrink-0">{pageLabel}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-6 py-8 px-6">
          {previewUrls.map((src, i) =>
            src ? (
              <div
                key={i}
                className="w-full max-w-lg shadow-sm rounded-lg overflow-hidden border border-zinc-200 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Página ${section.start + i + 1}`}
                  className="w-full h-auto block"
                />
              </div>
            ) : (
              <div
                key={i}
                className="w-full max-w-lg aspect-3/4 rounded-lg bg-zinc-200 animate-pulse"
              />
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
