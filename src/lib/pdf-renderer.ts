import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjs: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist");
    // Use the worker we copied to /public at build/install time
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

export async function loadPdfDocument(
  bytes: ArrayBuffer
): Promise<PDFDocumentProxy> {
  const lib = await getPdfjs();
  // Slice to create an independent copy so that pdfjs can transfer the buffer
  // to its worker without detaching the original ArrayBuffer stored in state.
  const task = lib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
  return task.promise;
}

export async function renderPageToDataUrl(
  doc: PDFDocumentProxy,
  pageNumber: number, // 1-based
  scale = 1
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext("2d")!;
  // pdfjs-dist v5 requires the `canvas` property in RenderParameters
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  page.cleanup();

  return canvas.toDataURL("image/jpeg", 0.8);
}
