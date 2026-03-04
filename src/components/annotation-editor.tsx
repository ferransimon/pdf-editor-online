"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowLeft,
  Pencil,
  Type,
  Square,
  Undo2,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Annotation,
  DrawStroke,
  TextAnnotation,
  RectAnnotation,
} from "@/lib/pdf-annotator";

// ─── constants ───────────────────────────────────────────────────────────────

type Tool = "draw" | "text" | "rect";

const PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#000000", // black
];

// Pixel widths on the rendered canvas
const LINE_WIDTHS = [2, 5, 12];

// ─── props ───────────────────────────────────────────────────────────────────

interface AnnotationEditorProps {
  pdfBytes: ArrayBuffer;
  pdfName: string;
  onBack: () => void;
}

// ─── component ───────────────────────────────────────────────────────────────

export function AnnotationEditor({ pdfBytes, pdfName, onBack }: AnnotationEditorProps) {
  // ── pdf state ──────────────────────────────────────────────────────────
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // ── tool state ─────────────────────────────────────────────────────────
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState(PALETTE[0]);
  const [lineWidthIdx, setLineWidthIdx] = useState(1);
  const [fontSize, setFontSize] = useState(16);

  // ── annotations (page index → Annotation[]) ────────────────────────────
  const [annotations, setAnnotations] = useState<Map<number, Annotation[]>>(new Map());

  // ── text dialog + draggable text ────────────────────────────────────────
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textDialogValue, setTextDialogValue] = useState("");
  const [pendingText, setPendingText] = useState<{
    text: string;
    x: number; // CSS px relative to canvas container
    y: number;
  } | null>(null);

  // ── canvas refs ────────────────────────────────────────────────────────
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── mutable refs (avoid stale closures in event handlers) ─────────────
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderGenRef = useRef(0); // incremented on every render request; used to discard stale renders
  const renderScaleRef = useRef(1); // scale used in last renderCurrentPage
  const isDrawingRef = useRef(false);
  const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const rectStartRef = useRef<{ x: number; y: number } | null>(null);
  const textDragRef = useRef<{ startPtrX: number; startPtrY: number; startElX: number; startElY: number } | null>(null);
  // Stable ref to redrawOverlay — avoids forward-reference when renderCurrentPage calls it
  const redrawOverlayRef = useRef<(pageIdx: number, extraAnn?: Annotation) => void>(() => {});

  // Mirror reactive state into refs so pointer handlers always read latest values
  const annotationsRef = useRef<Map<number, Annotation[]>>(new Map());
  const currentPageRef = useRef(0);
  const toolRef = useRef<Tool>("draw");
  const colorRef = useRef(PALETTE[0]);
  const lineWidthIdxRef = useRef(1);
  const fontSizeRef = useRef(16);

  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { lineWidthIdxRef.current = lineWidthIdx; }, [lineWidthIdx]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);

  // ── load PDF document ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) });
      const doc = await task.promise;
      if (cancelled) return;
      docRef.current = doc;
      setPageCount(doc.numPages);
    })();
    return () => { cancelled = true; };
  }, [pdfBytes]);

  // ── render current page to background canvas ───────────────────────────
  const renderCurrentPage = useCallback(async () => {
    const doc = docRef.current;
    const bgCanvas = bgCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!doc || !bgCanvas || !overlayCanvas) return;

    // Bump generation — any previously started render will see a stale gen and bail.
    const gen = ++renderGenRef.current;

    setPageLoading(true);

    const pdfPage = await doc.getPage(currentPage + 1);
    if (renderGenRef.current !== gen) return; // stale

    const nativeVp = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(1.8, 720 / nativeVp.width);
    renderScaleRef.current = scale;
    const viewport = pdfPage.getViewport({ scale });

    bgCanvas.width = viewport.width;
    bgCanvas.height = viewport.height;
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;

    const ctx = bgCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    const renderTask = pdfPage.render({ canvasContext: ctx, canvas: bgCanvas, viewport });
    await renderTask.promise;

    if (renderGenRef.current !== gen) return; // stale
    setPageLoading(false);
    // Redraw overlay immediately after page render finishes — correct page guaranteed via closure
    redrawOverlayRef.current(currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (pageCount > 0) renderCurrentPage();
  }, [pageCount, renderCurrentPage]);

  // ── redraw overlay canvas ──────────────────────────────────────────────
  // pageIdx must be passed explicitly so the call site controls which page's annotations to draw
  const redrawOverlay = useCallback((pageIdx: number, extraAnn?: Annotation) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const saved = annotationsRef.current.get(pageIdx) ?? [];
    const all: Annotation[] = extraAnn ? [...saved, extraAnn] : saved;

    for (const ann of all) {
      if (ann.kind === "draw") {
        if (ann.points.length < 2) continue;
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.normWidth * canvas.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const pts = ann.points;
        ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * canvas.width, pts[i].y * canvas.height);
        }
        ctx.stroke();
        ctx.restore();
      } else if (ann.kind === "text") {
        ctx.save();
        ctx.fillStyle = ann.color;
        const pxSize = ann.fontSize * renderScaleRef.current;
        ctx.font = `${pxSize}px sans-serif`;
        // Support multi-line
        const lines = ann.text.split("\n");
        lines.forEach((line, i) => {
          ctx.fillText(line, ann.x * canvas.width, ann.y * canvas.height + i * pxSize * 1.25);
        });
        ctx.restore();
      } else if (ann.kind === "rect") {
        ctx.save();
        ctx.strokeStyle = ann.color;
        ctx.fillStyle = ann.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(
          ann.x * canvas.width,
          ann.y * canvas.height,
          ann.w * canvas.width,
          ann.h * canvas.height
        );
        ctx.globalAlpha = 1;
        ctx.strokeRect(
          ann.x * canvas.width,
          ann.y * canvas.height,
          ann.w * canvas.width,
          ann.h * canvas.height
        );
        ctx.restore();
      }
    }
  }, []);

  // Keep ref in sync so renderCurrentPage (defined above) can call redrawOverlay without a forward-reference
  useEffect(() => { redrawOverlayRef.current = redrawOverlay; }, [redrawOverlay]);

  // Refresh overlay when annotations change (e.g. new annotation added on current page)
  useEffect(() => {
    if (!pageLoading) redrawOverlay(currentPage);
  }, [annotations, pageLoading, currentPage, redrawOverlay]);

  // ── helpers ────────────────────────────────────────────────────────────
  const getNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const addAnnotation = useCallback((ann: Annotation) => {
    setAnnotations((prev) => {
      const next = new Map(prev);
      const page = currentPageRef.current;
      next.set(page, [...(next.get(page) ?? []), ann]);
      return next;
    });
  }, []);

  // ── pointer events ─────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y } = getNorm(e);
    const t = toolRef.current;

    if (t === "draw") {
      isDrawingRef.current = true;
      currentStrokePointsRef.current = [{ x, y }];
      overlayCanvasRef.current?.setPointerCapture(e.pointerId);
      redrawOverlay(currentPageRef.current);
    } else if (t === "rect") {
      rectStartRef.current = { x, y };
      overlayCanvasRef.current?.setPointerCapture(e.pointerId);
    } else if (t === "text") {
      setTextDialogValue("");
      setTextDialogOpen(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getNorm(e);
    const t = toolRef.current;

    if (t === "draw" && isDrawingRef.current) {
      const canvas = overlayCanvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const pts = currentStrokePointsRef.current;
      const last = pts[pts.length - 1];
      pts.push({ x, y });

      // Draw only the new segment for performance (no full redraw)
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = LINE_WIDTHS[lineWidthIdxRef.current];
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(last.x * canvas.width, last.y * canvas.height);
      ctx.lineTo(x * canvas.width, y * canvas.height);
      ctx.stroke();
      ctx.restore();
    } else if (t === "rect" && rectStartRef.current) {
      const start = rectStartRef.current;
      const canvas = overlayCanvasRef.current!;
      redrawOverlay(currentPageRef.current);
      const ctx = canvas.getContext("2d")!;
      ctx.save();
      ctx.strokeStyle = colorRef.current;
      ctx.fillStyle = colorRef.current;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.15;
      const rx = Math.min(start.x, x) * canvas.width;
      const ry = Math.min(start.y, y) * canvas.height;
      const rw = Math.abs(x - start.x) * canvas.width;
      const rh = Math.abs(y - start.y) * canvas.height;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.globalAlpha = 1;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getNorm(e);
    const t = toolRef.current;

    if (t === "draw" && isDrawingRef.current) {
      isDrawingRef.current = false;
      const pts = currentStrokePointsRef.current;
      if (pts.length >= 2) {
        const stroke: DrawStroke = {
          kind: "draw",
          points: [...pts],
          color: colorRef.current,
          normWidth: LINE_WIDTHS[lineWidthIdxRef.current] / overlayCanvasRef.current!.width,
        };
        addAnnotation(stroke);
      }
      currentStrokePointsRef.current = [];
    } else if (t === "rect" && rectStartRef.current) {
      const start = rectStartRef.current;
      rectStartRef.current = null;
      const rx = Math.min(start.x, x);
      const ry = Math.min(start.y, y);
      const rw = Math.abs(x - start.x);
      const rh = Math.abs(y - start.y);
      if (rw > 0.01 && rh > 0.01) {
        const rect: RectAnnotation = {
          kind: "rect",
          x: rx, y: ry, w: rw, h: rh,
          color: colorRef.current,
        };
        addAnnotation(rect);
      } else {
        redrawOverlay(currentPageRef.current);
      }
    }
  };

  // ── text dialog handlers ────────────────────────────────────────────────
  const handleDialogSave = () => {
    if (!textDialogValue.trim()) { setTextDialogOpen(false); return; }
    // Place text at centre of canvas
    const canvas = bgCanvasRef.current;
    const cx = canvas ? canvas.width / 2 : 200;
    const cy = canvas ? canvas.height / 2 : 200;
    setPendingText({ text: textDialogValue.trim(), x: cx, y: cy });
    setTextDialogOpen(false);
    setTextDialogValue("");
  };

  const commitPendingText = () => {
    if (!pendingText) return;
    const canvas = bgCanvasRef.current!;
    const ann: TextAnnotation = {
      kind: "text",
      x: pendingText.x / canvas.width,
      y: pendingText.y / canvas.height,
      text: pendingText.text,
      fontSize: fontSizeRef.current,
      color: colorRef.current,
    };
    addAnnotation(ann);
    setPendingText(null);
  };

  // ── undo ───────────────────────────────────────────────────────────────
  const handleUndo = () => {
    setAnnotations((prev) => {
      const next = new Map(prev);
      const page = currentPageRef.current;
      const anns = next.get(page) ?? [];
      if (anns.length > 0) next.set(page, anns.slice(0, -1));
      return next;
    });
  };

  // ── download ───────────────────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { applyAnnotations } = await import("@/lib/pdf-annotator");
      const blob = await applyAnnotations(pdfBytes, annotations);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfName.replace(/\.pdf$/i, "") + "-anotado.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setDownloading(false);
    }
  };

  // ── page navigation ────────────────────────────────────────────────────
  const changePage = (delta: number) => {
    setCurrentPage((p) => Math.max(0, Math.min(pageCount - 1, p + delta)));
  };

  const hasAnnotationsOnPage = (annotations.get(currentPage) ?? []).length > 0;
  const cursorClass = tool === "text" ? "cursor-text" : "cursor-crosshair";

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 bg-white shrink-0 flex-wrap">

        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mr-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div className="h-4 w-px bg-zinc-200" />

        <span className="text-sm font-medium text-zinc-700 truncate max-w-44">
          {pdfName}
        </span>

        <div className="h-4 w-px bg-zinc-200" />

        {/* Tool buttons */}
        <div className="flex items-center gap-1">
          {(
            [
              { t: "draw" as Tool, icon: <Pencil className="h-3.5 w-3.5" />, label: "Dibujar" },
              { t: "text" as Tool, icon: <Type className="h-3.5 w-3.5" />, label: "Texto" },
              { t: "rect" as Tool, icon: <Square className="h-3.5 w-3.5" />, label: "Rectángulo" },
            ] as const
          ).map(({ t, icon, label }) => (
            <button
              key={t}
              title={label}
              onClick={() => setTool(t)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tool === t
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-200" />

        {/* Color palette */}
        <div className="flex items-center gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-5 w-5 rounded-full transition-transform ${
                color === c
                  ? "ring-2 ring-offset-1 ring-zinc-500 scale-110"
                  : "hover:scale-110"
              }`}
            />
          ))}
          <label title="Color personalizado" className="h-5 w-5 cursor-pointer relative">
            <div
              className="h-5 w-5 rounded-full border-2 border-zinc-300 overflow-hidden"
              style={{ backgroundColor: PALETTE.includes(color) ? "transparent" : color }}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[8px] text-zinc-500">
                {PALETTE.includes(color) ? "+" : ""}
              </span>
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="sr-only"
            />
          </label>
        </div>

        {/* Font size — text tool only */}
        {tool === "text" && (
          <>
            <div className="h-4 w-px bg-zinc-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400">Tamaño</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="text-xs border border-zinc-200 rounded-md px-1.5 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                {[8, 10, 12, 14, 16, 18, 24, 32, 48].map((s) => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Line width — draw tool only */}
        {tool === "draw" && (
          <>
            <div className="h-4 w-px bg-zinc-200" />
            <div className="flex items-center gap-1">
              {LINE_WIDTHS.map((w, i) => (
                <button
                  key={w}
                  title={`Grosor ${w}px`}
                  onClick={() => setLineWidthIdx(i)}
                  className={`px-2 py-2 rounded-md flex items-center justify-center transition-colors ${
                    lineWidthIdx === i
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{ width: 8 + i * 5, height: 2 + i * 2 }}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={!hasAnnotationsOnPage}
          title="Deshacer última anotación"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="h-4 w-4" />
          <span className="hidden sm:inline">Deshacer</span>
        </button>

        <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-1.5">
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Descargar
        </Button>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 overflow-auto bg-zinc-100 flex flex-col items-center gap-4 py-8">
        {pageCount === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-32">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500">Cargando PDF…</p>
          </div>
        ) : (
          <>
            {/* Page counter */}
            <p className="text-xs text-zinc-500 select-none">
              Página {currentPage + 1} de {pageCount}
            </p>

            {/* Canvas stack */}
            <div className="relative shadow-xl rounded shrink-0">
              {/* Inner wrapper: overflow-hidden for rounded canvas clip */}
              <div className="relative overflow-hidden rounded">
                <canvas ref={bgCanvasRef} className="block" />

                {/* Loading overlay */}
                {pageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                )}
              </div>

              {/* Overlay — drawing surface, outside overflow-hidden so textarea isn't clipped */}
              <canvas
                ref={overlayCanvasRef}
                className={`absolute inset-0 ${cursorClass}`}
                style={{
                  touchAction: "none",
                  pointerEvents: pageLoading || !!pendingText ? "none" : "auto",
                  opacity: pageLoading ? 0 : 1,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />

              {/* Draggable pending text — positioned over canvas, outside overflow-hidden */}
              {pendingText && (
                <div
                  style={{
                    position: "absolute",
                    left: pendingText.x,
                    top: pendingText.y,
                    transform: "translate(-50%, -50%)",
                    zIndex: 50,
                    cursor: textDragRef.current ? "grabbing" : "grab",
                    userSelect: "none",
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    textDragRef.current = {
                      startPtrX: e.clientX,
                      startPtrY: e.clientY,
                      startElX: pendingText.x,
                      startElY: pendingText.y,
                    };
                  }}
                  onPointerMove={(e) => {
                    if (!textDragRef.current) return;
                    const dx = e.clientX - textDragRef.current.startPtrX;
                    const dy = e.clientY - textDragRef.current.startPtrY;
                    setPendingText((prev) =>
                      prev ? { ...prev, x: textDragRef.current!.startElX + dx, y: textDragRef.current!.startElY + dy } : null
                    );
                  }}
                  onPointerUp={() => { textDragRef.current = null; }}
                >
                  {/* Text preview */}
                  <div
                    style={{
                      fontSize: fontSize * renderScaleRef.current + "px",
                      color,
                      fontFamily: "sans-serif",
                      lineHeight: 1.25,
                      whiteSpace: "pre",
                      padding: "4px 8px",
                      border: "2px dashed rgba(0,0,0,0.4)",
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.85)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      pointerEvents: "none",
                    }}
                  >
                    {pendingText.text}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5 mt-1.5 justify-center" style={{ pointerEvents: "auto" }}>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={commitPendingText}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 shadow"
                    >
                      Confirmar
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setPendingText(null)}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 shadow"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => changePage(-1)}
                disabled={currentPage === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                onClick={() => changePage(1)}
                disabled={currentPage === pageCount - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Text dialog ── */}
      {textDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setTextDialogOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-900">Añadir texto</h2>

            <textarea
              autoFocus
              rows={4}
              value={textDialogValue}
              onChange={(e) => setTextDialogValue(e.target.value)}
              placeholder="Escribe el texto aquí…"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleDialogSave();
                if (e.key === "Escape") setTextDialogOpen(false);
              }}
            />

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Tamaño</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="text-xs border border-zinc-200 rounded-md px-2 py-1 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                {[8, 10, 12, 14, 16, 18, 24, 32, 48].map((s) => (
                  <option key={s} value={s}>{s} pt</option>
                ))}
              </select>
              <div
                className="h-5 w-5 rounded-full border border-zinc-300 ml-auto"
                style={{ backgroundColor: color }}
                title="Color actual"
              />
            </div>

            <p className="text-xs text-zinc-400">
              El texto aparecerá en el centro de la página. Podrás arrastrarlo al lugar exacto.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setTextDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <Button onClick={handleDialogSave} size="sm" disabled={!textDialogValue.trim()}>
                Insertar texto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
