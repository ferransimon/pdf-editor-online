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

  // Load source with pdf-lib to copy pages directly (no rasterisation).
  // This preserves text, vectors and original compression, keeping file sizes small.
  const srcDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });

  const results: SplitResult[] = [];

  for (const section of sections) {
    const newDoc  = await PDFDocument.create();
    const copied  = await newDoc.copyPages(srcDoc, section.pages);
    for (const page of copied) {
      // Some PDFs have a CropBox smaller than the MediaBox (the visible area is a
      // sub-region of the physical page). pdf-lib may not inherit a CropBox that
      // lives in a parent page-tree node, which causes the full MediaBox to be
      // shown and content outside the original crop to become visible — or content
      // inside the crop to appear blank. Promoting CropBox → MediaBox fixes this.
      promoteCropBox(page);
      newDoc.addPage(page);
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

  return results;
}

/** Promotes CropBox to MediaBox so the visible page area is always correct. */
function promoteCropBox(page: import("pdf-lib").PDFPage): void {
  const mb = page.getMediaBox();
  const cb = page.getCropBox();
  if (
    cb.x !== mb.x ||
    cb.y !== mb.y ||
    cb.width !== mb.width ||
    cb.height !== mb.height
  ) {
    page.setMediaBox(cb.x, cb.y, cb.width, cb.height);
  }
}
