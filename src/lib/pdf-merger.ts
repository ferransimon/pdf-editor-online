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
}

export async function mergePages(
  sources: MergeSource[],
  pageOrder: MergePage[]
): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");

  const srcDocs = await Promise.all(
    sources.map((s) => PDFDocument.load(s.bytes.slice(0), { ignoreEncryption: true }))
  );

  const outDoc = await PDFDocument.create();

  for (const mp of pageOrder) {
    const [copied] = await outDoc.copyPages(srcDocs[mp.sourceIndex], [
      mp.pageIndex,
    ]);
    outDoc.addPage(copied);
  }

  const bytes = await outDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
