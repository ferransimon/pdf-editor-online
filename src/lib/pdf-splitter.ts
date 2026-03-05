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

  const results: SplitResult[] = [];

  for (const section of sections) {
    // Load a fresh copy of the original for every section and *remove* the pages
    // that don't belong to it. This is much more space-efficient than creating a
    // new document and copying pages in, because:
    //   • All shared resources (fonts, images, ICC profiles) are preserved as-is
    //     without duplication — copyPages clones resource dictionaries per page.
    //   • CropBox / MediaBox / TrimBox attributes are never touched, so page
    //     geometry is always correct without any post-processing.
    const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const totalPages = doc.getPageCount();
    const keepSet = new Set(section.pages);

    // Iterate from the last page backwards so removal doesn't shift indices.
    for (let i = totalPages - 1; i >= 0; i--) {
      if (!keepSet.has(i)) {
        doc.removePage(i);
      }
    }

    const bytes    = await doc.save({ useObjectStreams: true });
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
