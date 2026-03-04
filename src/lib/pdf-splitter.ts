export interface PdfSection {
  name: string;
  pages: number[]; // 0-based page indices
}

export interface SplitResult {
  name: string;
  blob: Blob;
}

export async function splitPdf(
  originalBytes: ArrayBuffer,
  sections: PdfSection[]
): Promise<SplitResult[]> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  // Load source in pdfjs so each page is rendered exactly as the user sees it.
  const pdfjsDoc = await pdfjs
    .getDocument({ data: new Uint8Array(originalBytes.slice(0)) })
    .promise;

  const PRINT_SCALE = 2; // ~144 dpi in the output

  const results: SplitResult[] = [];

  for (const section of sections) {
    const newDoc = await PDFDocument.create();

    for (const pageIdx of section.pages) {
      const pdfjsPage = await pdfjsDoc.getPage(pageIdx + 1);

      const viewport = pdfjsPage.getViewport({ scale: PRINT_SCALE });
      const canvas   = document.createElement("canvas");
      canvas.width   = Math.round(viewport.width);
      canvas.height  = Math.round(viewport.height);
      const ctx      = canvas.getContext("2d")!;
      await pdfjsPage.render({ canvasContext: ctx, canvas, viewport }).promise;

      const dataUrl  = canvas.toDataURL("image/png");
      const b64      = dataUrl.split(",")[1];
      const imgBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      const nativeVp = pdfjsPage.getViewport({ scale: 1 });
      const pdfPage  = newDoc.addPage([nativeVp.width, nativeVp.height]);
      const embedded = await newDoc.embedPng(imgBytes);
      pdfPage.drawImage(embedded, {
        x: 0, y: 0,
        width:  nativeVp.width,
        height: nativeVp.height,
      });
    }

    const bytes    = await newDoc.save();
    const safeName = section.name.endsWith(".pdf")
      ? section.name
      : `${section.name}.pdf`;

    results.push({
      name: safeName,
      blob: new Blob([bytes], { type: "application/pdf" }),
    });
  }

  await pdfjsDoc.destroy();
  return results;
}
