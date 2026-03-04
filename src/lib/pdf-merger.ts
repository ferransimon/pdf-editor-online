export interface MergeSource {
  name: string;
  bytes: ArrayBuffer;
}

export interface MergePage {
  id: string; // unique key for React
  sourceIndex: number; // which source PDF (0-based)
  pageIndex: number; // 0-based page within that source
  thumbnail: string;
  sourceName: string;
  /** Effective page dimensions in PDF units (pt), resolved by pdfjs — handles
   *  CropBox / TrimBox / ArtBox inheritance and page rotation correctly. */
  widthPt: number;
  heightPt: number;
}

export async function mergePages(
  sources: MergeSource[],
  pageOrder: MergePage[]
): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  // Load every source PDF in pdfjs so we can render pages accurately.
  // pdfjs resolves CropBox / TrimBox / rotation — the rendered output is
  // exactly what the user sees in the editor.
  const pdfjsDocs = await Promise.all(
    sources.map((s) =>
      pdfjs.getDocument({ data: new Uint8Array(s.bytes.slice(0)) }).promise
    )
  );

  const outDoc = await PDFDocument.create();

  for (const mp of pageOrder) {
    const pdfjsPage = await pdfjsDocs[mp.sourceIndex].getPage(mp.pageIndex + 1);

    // Scale that keeps the output at ~144 dpi (2× the 72 pt/inch PDF unit).
    const PRINT_SCALE = 2;
    const viewport = pdfjsPage.getViewport({ scale: PRINT_SCALE });

    // Render to an offscreen canvas.
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await pdfjsPage.render({ canvasContext: ctx, canvas, viewport }).promise;

    // Convert to PNG bytes.
    const dataUrl  = canvas.toDataURL("image/png");
    const b64      = dataUrl.split(",")[1];
    const imgBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    // Create a new PDF page whose size matches the pdfjs-resolved viewport
    // in PDF units (at scale 1 == 72 dpi == 1 pt).
    const nativeVp  = pdfjsPage.getViewport({ scale: 1 });
    const pdfPage   = outDoc.addPage([nativeVp.width, nativeVp.height]);
    const embedded  = await outDoc.embedPng(imgBytes);
    pdfPage.drawImage(embedded, {
      x: 0, y: 0,
      width:  nativeVp.width,
      height: nativeVp.height,
    });
  }

  await Promise.all(pdfjsDocs.map((d) => d.destroy()));

  const bytes = await outDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
