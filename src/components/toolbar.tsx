"use client";

import { FileText, Download, RotateCcw, Loader2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolbarProps {
  pdfName: string;
  sectionCount: number;
  downloading: boolean;
  onDownload: () => void;
  onReset: () => void;
}

export function Toolbar({
  pdfName,
  sectionCount,
  downloading,
  onDownload,
  onReset,
}: ToolbarProps) {
  return (
    <header className="flex items-center gap-4 border-b border-zinc-200 bg-white px-6 h-14 shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Scissors className="h-4 w-4 text-zinc-400 shrink-0" />
        <span className="text-sm font-semibold text-zinc-900 tracking-tight">
          PDF Splitter
        </span>
        <div className="w-px h-4 bg-zinc-200 mx-1" />
        <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span className="text-sm text-zinc-600 truncate">{pdfName}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400">
          {sectionCount} sección{sectionCount !== 1 ? "es" : ""}
        </span>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Nuevo
        </Button>
        <Button size="sm" onClick={onDownload} disabled={downloading}>
          {downloading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generando…
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Descargar ZIP
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
