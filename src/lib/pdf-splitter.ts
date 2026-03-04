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
  // Slice to ensure we have a fresh, non-detached buffer to load from.
  const srcDoc = await PDFDocument.load(originalBytes.slice(0), { ignoreEncryption: true });

  const results: SplitResult[] = [];
  for (const section of sections) {
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, section.pages);
    for (const page of copied) newDoc.addPage(page);

    const bytes = await newDoc.save();
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
