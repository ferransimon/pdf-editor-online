"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { ModeSelector } from "@/components/mode-selector";
import { MergeEditor } from "@/components/merge-editor";
import { AnnotationEditor } from "@/components/annotation-editor";
import { Uploader } from "@/components/uploader";
import { Toolbar } from "@/components/toolbar";
import { SidebarThumbnails } from "@/components/sidebar-thumbnails";
import { SectionPreview } from "@/components/section-preview";
import { SectionList } from "@/components/section-list";
import type { PdfFile } from "@/lib/file-access";

// ─── helpers ────────────────────────────────────────────────────────────────

interface Section {
  start: number;
  end: number;
}

function getSections(pageCount: number, splitPoints: Set<number>): Section[] {
  if (pageCount === 0) return [];
  const sorted = [0, ...Array.from(splitPoints).sort((a, b) => a - b), pageCount];
  return sorted.slice(0, -1).map((start, i) => ({
    start,
    end: sorted[i + 1] - 1,
  }));
}

function getDefaultName(section: Section): string {
  if (section.start === section.end) return `Página ${section.start + 1}`;
  return `Páginas ${section.start + 1}-${section.end + 1}`;
}

// ─── page ───────────────────────────────────────────────────────────────────

type Phase = "idle" | "split-upload" | "loading" | "loaded" | "merge" | "annotate-upload" | "annotate";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pdfName, setPdfName] = useState("");
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [annotatePdfBytes, setAnnotatePdfBytes] = useState<ArrayBuffer | null>(null);
  const [annotatePdfName, setAnnotatePdfName] = useState("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [splitPoints, setSplitPoints] = useState<Set<number>>(new Set());
  const [sectionNames, setSectionNames] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const docRef = useRef<PDFDocumentProxy | null>(null);

  const sections = getSections(thumbnails.length, splitPoints);

  // ── file loaded ────────────────────────────────────────────────────────────
  const handleFileLoaded = useCallback(async (file: PdfFile) => {
    setPhase("loading");
    setPdfName(file.name);
    setPdfBytes(file.bytes);
    setSplitPoints(new Set());
    setThumbnails([]);
    setActiveSection(0);

    const { loadPdfDocument, renderPageToDataUrl } = await import(
      "@/lib/pdf-renderer"
    );

    const doc = await loadPdfDocument(file.bytes);
    docRef.current = doc;

    // Blank placeholders so the UI can show skeletons immediately
    const blanks: string[] = new Array(doc.numPages).fill("");
    setThumbnails([...blanks]);
    setSectionNames([getDefaultName({ start: 0, end: doc.numPages - 1 })]);
    setPhase("loaded");

    // Render thumbnails progressively (scale 0.4 for sidebar)
    for (let i = 1; i <= doc.numPages; i++) {
      const dataUrl = await renderPageToDataUrl(doc, i, 0.4);
      blanks[i - 1] = dataUrl;
      setThumbnails([...blanks]);
    }
  }, []);

  // ── split points ───────────────────────────────────────────────────────────
  const handleToggleSplit = useCallback((index: number) => {
    setSplitPoints((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Recompute section names when sections change (resets to defaults)
  useEffect(() => {
    const secs = getSections(thumbnails.length, splitPoints);
    setSectionNames(secs.map(getDefaultName));
    setActiveSection((prev) => Math.min(prev, Math.max(0, secs.length - 1)));
     
  }, [splitPoints, thumbnails.length]);

  // ── download ───────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!pdfBytes || sections.length === 0) return;
    setDownloading(true);
    try {
      const { splitPdf } = await import("@/lib/pdf-splitter");
      const { buildZip } = await import("@/lib/zip-builder");

      const splitSections = sections.map((s, i) => ({
        name: sectionNames[i] || getDefaultName(s),
        pages: Array.from({ length: s.end - s.start + 1 }, (_, k) => s.start + k),
      }));

      const results = await splitPdf(pdfBytes, splitSections);
      await buildZip(results, pdfName);
    } finally {
      setDownloading(false);
    }
  };

  // ── reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    docRef.current?.destroy();
    docRef.current = null;
    setPdfBytes(null);
    setPdfName("");
    setThumbnails([]);
    setSplitPoints(new Set());
    setSectionNames([]);
    setActiveSection(0);
    setPhase("idle");
  };

  // ── render ─────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <ModeSelector
        onSplit={() => setPhase("split-upload")}
        onMerge={() => setPhase("merge")}
        onAnnotate={() => setPhase("annotate-upload")}
      />
    );
  }

  if (phase === "merge") {
    return <MergeEditor onBack={() => setPhase("idle")} />;
  }

  if (phase === "annotate") {
    return (
      <AnnotationEditor
        pdfBytes={annotatePdfBytes!}
        pdfName={annotatePdfName}
        onBack={() => setPhase("idle")}
      />
    );
  }

  if (phase === "annotate-upload") {
    return (
      <Uploader
        mode="annotate"
        onFileLoaded={async (file) => {
          setAnnotatePdfBytes(file.bytes);
          setAnnotatePdfName(file.name);
          setPhase("annotate");
        }}
        onBack={() => setPhase("idle")}
      />
    );
  }

  if (phase === "split-upload" || phase === "loading") {
    return (
      <Uploader
        onFileLoaded={handleFileLoaded}
        loading={phase === "loading"}
        onBack={() => setPhase("idle")}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <Toolbar
        pdfName={pdfName}
        sectionCount={sections.length}
        downloading={downloading}
        onDownload={handleDownload}
        onReset={handleReset}
      />
      <div className="flex flex-1 overflow-hidden">
        <SidebarThumbnails
          thumbnails={thumbnails}
          splitPoints={splitPoints}
          activeSection={activeSection}
          sections={sections}
          onToggleSplit={handleToggleSplit}
          onSelectSection={setActiveSection}
        />
        <SectionPreview
          pdfDoc={docRef.current}
          thumbnails={thumbnails}
          section={sections[activeSection] ?? null}
          sectionName={sectionNames[activeSection] ?? ""}
        />
        <SectionList
          sections={sections}
          sectionNames={sectionNames}
          activeSection={activeSection}
          onRenameSection={(i, name) =>
            setSectionNames((prev) => {
              const next = [...prev];
              next[i] = name;
              return next;
            })
          }
          onSelectSection={setActiveSection}
        />
      </div>
    </div>
  );
}
