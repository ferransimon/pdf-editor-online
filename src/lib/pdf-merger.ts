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

  // Load every source PDF with pdf-lib so we can copy pages directly.
  // Copying pages preserves text, vectors and original compression,
  // keeping file sizes close to the originals.
  const srcDocs = await Promise.all(
    sources.map((s) => PDFDocument.load(s.bytes, { ignoreEncryption: true }))
  );

  const outDoc = await PDFDocument.create();

  for (const mp of pageOrder) {
    const [copiedPage] = await outDoc.copyPages(srcDocs[mp.sourceIndex], [mp.pageIndex]);
    // Promote CropBox → MediaBox to avoid blank/misaligned pages when the PDF
    // has a CropBox smaller than the MediaBox (inherited from the page tree).
    promoteCropBox(copiedPage);
    outDoc.addPage(copiedPage);
  }

  // useObjectStreams compresses the cross-reference table and object headers
  // (PDF 1.5 object streams), reducing the structural overhead of the output.
  const bytes = await outDoc.save({ useObjectStreams: true });
  return new Blob([bytes], { type: "application/pdf" });
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
