"use client";

import {
  useState,
  useCallback,
  useRef,
  useId,
  Fragment,
} from "react";
import {
  Upload,
  Loader2,
  Download,
  ArrowLeft,
  X,
  Plus,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MergePage, MergeSource } from "@/lib/pdf-merger";

type SubPhase = "idle" | "loading" | "editing";

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

  // D&D state
  const dragIdx = useRef<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [isDraggingPage, setIsDraggingPage] = useState(false);

  const uid = useId();
  const idCounter = useRef(0);
  const nextId = () => `${uid}-${idCounter.current++}`;

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
          newPages.push({
            id: nextId(),
            sourceIndex: sourceOffset + fi,
            pageIndex: pi - 1,
            thumbnail,
            sourceName: file.name.replace(/\.pdf$/i, ""),
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
    setIsDraggingPage(true);
  };

  const handlePageDragEnd = () => {
    dragIdx.current = null;
    setDragOverSlot(null);
    setIsDraggingPage(false);
  };

  const handleSlotDragOver = (e: React.DragEvent, slot: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slot);
  };

  const handleSlotDrop = (e: React.DragEvent, slot: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null) return;
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      // After removing, the insertion index shifts if from < slot
      const insertAt = from < slot ? slot - 1 : slot;
      next.splice(insertAt, 0, moved);
      return next;
    });
    dragIdx.current = null;
    setDragOverSlot(null);
    setIsDraggingPage(false);
  };

  const removePage = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
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
          <div className="flex flex-wrap content-start gap-3">
            {/* Slot BEFORE first card */}
            <DropSlot
              slot={0}
              active={dragOverSlot === 0}
              visible={isDraggingPage}
              onDragOver={(e) => handleSlotDragOver(e, 0)}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleSlotDrop(e, 0)}
            />

            {pages.map((page, idx) => (
              <Fragment key={page.id}>
                {/* Card */}
                <div
                  key={page.id}
                  draggable
                  onDragStart={(e) => handlePageDragStart(e, idx)}
                  onDragEnd={handlePageDragEnd}
                  className={cn(
                    "group relative flex flex-col w-36 shrink-0 rounded-lg border-2 bg-white overflow-hidden cursor-grab active:cursor-grabbing transition-opacity select-none",
                    isDraggingPage && dragIdx.current === idx
                      ? "opacity-30 border-zinc-200"
                      : "opacity-100 border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                  )}
                >
                  {/* Grip */}
                  <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <GripVertical className="h-3.5 w-3.5 text-zinc-400" />
                  </div>

                  {/* Remove */}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removePage(idx); }}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full bg-white border border-zinc-200 p-0.5 hover:bg-red-50 hover:border-red-200"
                  >
                    <X className="h-2.5 w-2.5 text-zinc-500 hover:text-red-500" />
                  </button>

                  {/* Thumbnail */}
                  <div className="w-full aspect-3/4 bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.thumbnail}
                      alt={`Página ${idx + 1}`}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex flex-col gap-0.5 px-2 py-1.5 border-t border-zinc-100">
                    <span className="text-[10px] font-medium text-zinc-700 leading-none">
                      Pág. {idx + 1}
                    </span>
                    <span className="text-[9px] text-zinc-400 leading-none truncate" title={page.sourceName}>
                      {page.sourceName}
                    </span>
                  </div>
                </div>

                {/* Slot AFTER this card */}
                <DropSlot
                  key={`slot-${idx + 1}`}
                  slot={idx + 1}
                  active={dragOverSlot === idx + 1}
                  visible={isDraggingPage}
                  onDragOver={(e) => handleSlotDragOver(e, idx + 1)}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => handleSlotDrop(e, idx + 1)}
                />
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DropSlot ─────────────────────────────────────────────────────────────────
// A thin insertion zone between page cards that expands when dragged over.

interface DropSlotProps {
  slot: number;
  active: boolean;
  visible: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function DropSlot({ active, visible, onDragOver, onDragLeave, onDrop }: DropSlotProps) {
  if (!visible) return null;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "shrink-0 rounded-lg border-2 border-dashed transition-all duration-150 self-stretch",
        active
          ? "w-36 border-zinc-900 bg-zinc-100"
          : "w-3 border-zinc-300 bg-zinc-50 opacity-60"
      )}
    />
  );
}
