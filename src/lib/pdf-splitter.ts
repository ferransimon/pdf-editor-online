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

  // Load the source once; copyPages will only copy the objects actually
  // referenced by the requested pages (content streams, fonts, images, etc.).
  // Unlike the removePage approach, pdf-lib does NOT garbage-collect orphaned
  // objects after removal — so every "removed" page's resources stay in the
  // file and both halves end up the same size as the original.
  const srcDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });

  const results: SplitResult[] = [];

  for (const section of sections) {
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, section.pages);
    for (const page of copied) {
      promoteCropBox(page);
      newDoc.addPage(page);
    }

    // useObjectStreams compresses the cross-reference table (PDF 1.5 object
    // streams), partially offsetting the re-serialisation overhead.
    const bytes    = await newDoc.save({ useObjectStreams: true });
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
