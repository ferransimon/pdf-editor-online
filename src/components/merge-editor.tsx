"use client";

import {
  useState,
  useCallback,
  useRef,
  useId,
  useEffect,
} from "react";
import { flushSync } from "react-dom";
import {
  Upload,
  Loader2,
  Download,
  ArrowLeft,
  X,
  Plus,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MergePage, MergeSource } from "@/lib/pdf-merger";

type SubPhase = "idle" | "loading" | "editing";

/** Activate drop slot when cursor enters within this radius of its center */
const ACTIVATE_THRESHOLD = 80;
/** Keep the active slot open until cursor moves beyond this radius */
const DEACTIVATE_THRESHOLD = 130;

interface MergeEditorProps {
  onBack: () => void;
}

export function MergeEditor({ onBack }: MergeEditorProps) {
  const [subPhase, setSubPhase] = useState<SubPhase>("idle");
  const [sources, setSources] = useState<MergeSource[]>([]);
  const [pages, setPages] = useState<MergePage[]>([]);
  const [outputName, setOutputName] = useState("merged");
  const [dragging, setDragging] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── page preview state ────────────────────────────────────────────────────
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // D&D state
  const dragIdx = useRef<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  // Ref mirror so handlers always read the latest slot without stale closures
  const activeSlotRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Stable snapshot of insertion-point {x,y} positions taken once at drag start
  const slotPositionsRef = useRef<Array<{ x: number; y: number }>>([]);

  // ── open preview (renders high-res on demand) ────────────────────────────
  const openPreview = useCallback(async (idx: number) => {
    setPreviewIdx(idx);
    setPreviewDataUrl(null);
    setPreviewLoading(true);
    try {
      const page = pages[idx];
      const { loadPdfDocument, renderPageToDataUrl } = await import("@/lib/pdf-renderer");
      const src = sources[page.sourceIndex];
      const doc = await loadPdfDocument(src.bytes);
      const url = await renderPageToDataUrl(doc, page.pageIndex + 1, 2.0);
      doc.destroy();
      setPreviewDataUrl(url);
    } finally {
      setPreviewLoading(false);
    }
  }, [pages, sources]);

  const closePreview = useCallback(() => {
    setPreviewIdx(null);
    setPreviewDataUrl(null);
  }, []);

  // Keyboard: Escape closes, arrows navigate
  useEffect(() => {
    if (previewIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closePreview(); return; }
      if (e.key === "ArrowLeft"  && previewIdx > 0)               openPreview(previewIdx - 1);
      if (e.key === "ArrowRight" && previewIdx < pages.length - 1) openPreview(previewIdx + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewIdx, pages.length, openPreview, closePreview]);

  const activateSlot = (slot: number | null) => {
    activeSlotRef.current = slot;
    setDragOverSlot(slot);
  };

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const idCounter = useRef(0);
  // CSS-safe id: starts with a letter, only alphanumeric+dash
  const nextId = () => `pg${uid}${idCounter.current++}`;

  // ── load files ────────────────────────────────────────────────────────────
  const loadFiles = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter(
        (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
      );
      if (!pdfs.length) {
        setError("Selecciona al menos un archivo PDF.");
        return;
      }
      setError(null);
      setSubPhase("loading");
      setLoadingLabel("Leyendo archivos…");

      const { loadPdfDocument, renderPageToDataUrl } = await import(
        "@/lib/pdf-renderer"
      );

      const newSources: MergeSource[] = [];
      const newPages: MergePage[] = [];
      const sourceOffset = sources.length;

      for (let fi = 0; fi < pdfs.length; fi++) {
        const file = pdfs[fi];
        setLoadingLabel(`Cargando ${file.name} (${fi + 1}/${pdfs.length})…`);
        const bytes = await file.arrayBuffer();
        newSources.push({ name: file.name, bytes });

        const doc = await loadPdfDocument(bytes);
        for (let pi = 1; pi <= doc.numPages; pi++) {
          setLoadingLabel(
            `Renderizando ${file.name} — pág. ${pi}/${doc.numPages}…`
          );
          const thumbnail = await renderPageToDataUrl(doc, pi, 0.5);
          // Get the effective page dimensions from pdfjs (resolves CropBox /
          // inherited MediaBox / rotation) so mergePages can normalise them.
          const pdfjsPage = await doc.getPage(pi);
          const viewport = pdfjsPage.getViewport({ scale: 1 });
          newPages.push({
            id: nextId(),
            sourceIndex: sourceOffset + fi,
            pageIndex: pi - 1,
            thumbnail,
            sourceName: file.name.replace(/\.pdf$/i, ""),
            widthPt: viewport.width,
            heightPt: viewport.height,
          });
        }
        doc.destroy();
      }

      setSources((prev) => [...prev, ...newSources]);
      setPages((prev) => [...prev, ...newPages]);
      if (sources.length === 0 && newSources.length === 1) {
        setOutputName(newSources[0].name.replace(/\.pdf$/i, "") + "_merged");
      }
      setSubPhase("editing");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources.length]
  );

  // ── file input trigger ────────────────────────────────────────────────────
  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) loadFiles(Array.from(input.files));
    };
    input.click();
  };

  // ── drag & drop onto the drop zone ────────────────────────────────────────
  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      loadFiles(Array.from(e.dataTransfer.files));
    }
  };

  // ── page D&D reorder ──────────────────────────────────────────────────────

  const handlePageDragStart = (e: React.DragEvent, idx: number) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    // Snapshot card positions BEFORE any DOM mutation.
    // Each card's left edge = slot before it; last card's right edge = slot after all.
    if (gridRef.current) {
      const cards = Array.from(
        gridRef.current.querySelectorAll<HTMLElement>("[data-card-idx]")
      );
      const positions = cards.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top + r.height / 2 };
      });
      const last = cards.at(-1);
      if (last) {
        const r = last.getBoundingClientRect();
        positions.push({ x: r.right, y: r.top + r.height / 2 });
      }
      slotPositionsRef.current = positions;
    }
    gridRef.current?.setAttribute("data-dragging", "true");
  };

  const handlePageDragEnd = () => {
    dragIdx.current = null;
    activateSlot(null);
    gridRef.current?.removeAttribute("data-dragging");
  };

  // Single handler on the grid — uses stable position snapshot for hysteresis
  const handleGridDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIdx.current === null) return;

    const positions = slotPositionsRef.current;
    const current = activeSlotRef.current;

    let closestSlot: number | null = null;
    let closestDist = Infinity;
    positions.forEach(({ x, y }, slot) => {
      const dist = Math.hypot(e.clientX - x, e.clientY - y);
      if (dist < closestDist) {
        closestDist = dist;
        closestSlot = slot;
      }
    });

    let next: number | null;
    if (closestSlot !== null && closestDist < ACTIVATE_THRESHOLD) {
      next = closestSlot;
    } else if (current !== null) {
      const pos = positions[current];
      if (pos) {
        const distToCurrent = Math.hypot(e.clientX - pos.x, e.clientY - pos.y);
        next = distToCurrent < DEACTIVATE_THRESHOLD ? current : null;
      } else {
        next = null;
      }
    } else {
      next = null;
    }

    if (next !== current) activateSlot(next);
  };

  const handleGridDragLeave = (e: React.DragEvent) => {
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      activateSlot(null);
    }
  };

  const handleGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx.current;
    const slot = activeSlotRef.current;
    if (from === null || slot === null) return;

    dragIdx.current = null;
    activateSlot(null);
    gridRef.current?.removeAttribute("data-dragging");

    const reorder = () => {
      setPages((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        const insertAt = from < slot ? slot - 1 : slot;
        next.splice(insertAt, 0, moved);
        return next;
      });
    };

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(() => { flushSync(reorder); });
    } else {
      reorder();
    }
  };

  const removePage = (idx: number) => {
    const doRemove = () => setPages((prev) => prev.filter((_, i) => i !== idx));
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(() => flushSync(doRemove));
    } else {
      doRemove();
    }
  };

  // ── download ──────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!pages.length) return;
    setDownloading(true);
    try {
      const { mergePages } = await import("@/lib/pdf-merger");
      const blob = await mergePages(sources, pages);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outputName.endsWith(".pdf")
        ? outputName
        : `${outputName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setDownloading(false);
    }
  };

  // ── render: loading ───────────────────────────────────────────────────────
  if (subPhase === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-500">{loadingLabel}</p>
      </div>
    );
  }

  // ── render: upload zone ───────────────────────────────────────────────────
  if (subPhase === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-8 max-w-md w-full px-8">
          <button
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Unir PDFs
            </h1>
            <p className="text-sm text-zinc-400">
              Selecciona 2 o más PDFs. Luego podrás reordenar las páginas.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleZoneDrop}
            onClick={openFilePicker}
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
                Arrastra los PDFs aquí
              </p>
              <p className="text-xs text-zinc-400">
                o haz clic para seleccionarlos
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button onClick={openFilePicker} variant="outline" className="w-full">
            Seleccionar PDFs
          </Button>
        </div>
      </div>
    );
  }

  // ── render: editor ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Toolbar */}
      <header className="flex items-center gap-4 border-b border-zinc-200 bg-white px-6 h-14 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </button>
        <div className="w-px h-4 bg-zinc-200" />
        <span className="text-sm font-semibold text-zinc-900 shrink-0">
          Unir PDFs
        </span>
        <div className="flex-1" />
        <span className="text-xs text-zinc-400 shrink-0">
          {pages.length} página{pages.length !== 1 ? "s" : ""} ·{" "}
          {sources.length} archivo{sources.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1 border border-zinc-200 rounded-md overflow-hidden">
          <Input
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            className="h-7 text-xs border-0 rounded-none w-44 focus-visible:ring-0"
            placeholder="nombre del archivo"
          />
          <span className="text-xs text-zinc-400 pr-2">.pdf</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={openFilePicker}
          disabled={downloading}
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir PDFs
        </Button>
        <Button size="sm" onClick={handleDownload} disabled={downloading || pages.length === 0}>
          {downloading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generando…
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Descargar PDF
            </>
          )}
        </Button>
      </header>

      {/* Page grid */}
      <div className="flex-1 overflow-y-auto bg-zinc-50 p-6">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-sm text-zinc-400">
              Todas las páginas han sido eliminadas.
            </p>
            <Button variant="outline" size="sm" onClick={openFilePicker}>
              <Plus className="h-3.5 w-3.5" />
              Añadir PDFs
            </Button>
          </div>
        ) : (
          (() => {
            // Build display array: remove dragged card, insert placeholder at active slot.
            // When no slot is active, show all cards normally (dragged card fades via CSS).
            const dragFrom = dragIdx.current;
            type DI =
              | { kind: "card"; page: MergePage; realIdx: number }
              | { kind: "placeholder" };

            let items: DI[];
            if (dragOverSlot !== null && dragFrom !== null) {
              const withoutDragged: DI[] = pages
                .map((page, i) => ({ kind: "card" as const, page, realIdx: i }))
                .filter((_, i) => i !== dragFrom);
              // Slot numbers reference the original pages array;
              // adjust index after removing the dragged card.
              const insertIdx =
                dragOverSlot <= dragFrom ? dragOverSlot : dragOverSlot - 1;
              items = [
                ...withoutDragged.slice(0, insertIdx),
                { kind: "placeholder" },
                ...withoutDragged.slice(insertIdx),
              ];
            } else {
              items = pages.map((page, i) => ({
                kind: "card" as const,
                page,
                realIdx: i,
              }));
            }

            return (
              <div
                ref={gridRef}
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(144px, 1fr))" }}
                onDragOver={handleGridDragOver}
                onDragLeave={handleGridDragLeave}
                onDrop={handleGridDrop}
              >
                {items.map((item, displayIdx) => {
                  if (item.kind === "placeholder") {
                    return (
                      <div
                        key="placeholder"
                        className="rounded-lg border-2 border-dashed border-zinc-400 bg-zinc-100 aspect-3/4 animate-pulse"
                      />
                    );
                  }
                  const { page, realIdx } = item;
                  return (
                    <div
                      key={page.id}
                      data-card-idx={realIdx}
                      draggable
                      onDragStart={(e) => handlePageDragStart(e, realIdx)}
                      onDragEnd={handlePageDragEnd}
                      onDoubleClick={(e) => { e.stopPropagation(); openPreview(realIdx); }}
                      style={{ viewTransitionName: page.id }}
                      className="group relative flex flex-col rounded-lg border-2 border-zinc-200 bg-white overflow-hidden cursor-grab active:cursor-grabbing select-none hover:border-zinc-300 hover:shadow-sm transition-shadow"
                    >
                      {/* Grip */}
                      <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <GripVertical className="h-3.5 w-3.5 text-zinc-400" />
                      </div>

                      {/* Remove */}
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); removePage(realIdx); }}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full bg-white border border-zinc-200 p-0.5 hover:bg-red-50 hover:border-red-200"
                      >
                        <X className="h-2.5 w-2.5 text-zinc-500 hover:text-red-500" />
                      </button>

                      {/* Thumbnail */}
                      <div className="relative w-full aspect-3/4 bg-zinc-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.thumbnail}
                          alt={`Página ${displayIdx + 1}`}
                          className="w-full h-full object-contain"
                          draggable={false}
                        />
                        {/* Zoom hint */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-black/40 rounded-full p-1.5">
                            <ZoomIn className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex flex-col gap-0.5 px-2 py-1.5 border-t border-zinc-100">
                        <span className="text-[10px] font-medium text-zinc-700 leading-none">
                          Pág. {displayIdx + 1}
                        </span>
                        <span className="text-[9px] text-zinc-400 leading-none truncate" title={page.sourceName}>
                          {page.sourceName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>

      {/* ── Page preview modal ── */}
      {previewIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={closePreview}
        >
          {/* Close button */}
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Prev */}
          {previewIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); openPreview(previewIdx - 1); }}
              className="absolute left-4 rounded-full bg-white/10 hover:bg-white/20 p-3 transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
          )}

          {/* Page image */}
          <div
            className="flex items-center justify-center max-h-[90vh] max-w-[85vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {previewLoading || !previewDataUrl ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Cargando…</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewDataUrl}
                alt={`Vista previa pág. ${previewIdx + 1}`}
                className="max-h-[90vh] max-w-[85vw] object-contain shadow-2xl rounded"
                draggable={false}
              />
            )}
          </div>

          {/* Next */}
          {previewIdx < pages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); openPreview(previewIdx + 1); }}
              className="absolute right-4 rounded-full bg-white/10 hover:bg-white/20 p-3 transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          )}

          {/* Page counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full">
            Pág. {previewIdx + 1} / {pages.length}
            {pages[previewIdx] && (
              <span className="ml-2 opacity-60">{pages[previewIdx].sourceName}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
