export type CompressionLevel = "low" | "medium" | "high" | "extreme";

export interface CompressionOptions {
  level: CompressionLevel;
  jpegQuality?: number; // For extreme mode (0-1), default 0.7
  dpi?: number; // For extreme mode, default 150
}

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export async function compressPdf(
  originalBytes: ArrayBuffer,
  options: CompressionOptions
): Promise<CompressionResult> {
  const originalSize = originalBytes.byteLength;

  // Use aggressive lossy compression for "extreme" level
  if (options.level === "extreme") {
    const blob = await compressPdfExtreme(originalBytes, {
      jpegQuality: options.jpegQuality ?? 0.7,
      dpi: options.dpi ?? 150,
    });
    const compressedSize = blob.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
    return {
      blob,
      originalSize,
      compressedSize,
      compressionRatio: Math.max(0, compressionRatio),
    };
  }

  // Standard lossless compression
  const { PDFDocument } = await import("pdf-lib");

  // Load source PDF
  const srcDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });

  // Create new document and copy all pages (removes unused objects)
  const outDoc = await PDFDocument.create();
  const pageCount = srcDoc.getPageCount();
  const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
  const copiedPages = await outDoc.copyPages(srcDoc, pageIndices);

  for (const page of copiedPages) {
    promoteCropBox(page);
    outDoc.addPage(page);
  }

  // Strip metadata for "high" compression
  if (options.level === "high") {
    stripMetadata(outDoc);
  }

  // Save with compression based on level
  const useStreams = options.level !== "low";
  const bytes = await outDoc.save({
    useObjectStreams: useStreams,
  });

  const compressedSize = bytes.byteLength;
  const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    originalSize,
    compressedSize,
    compressionRatio: Math.max(0, compressionRatio),
  };
}

/**
 * Aggressive lossy compression: renders each page to canvas and reconstructs as images
 * WARNING: This loses text selectability, vector graphics, links, and other PDF features
 */
async function compressPdfExtreme(
  originalBytes: ArrayBuffer,
  options: { jpegQuality: number; dpi: number }
): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const { loadPdfDocument } = await import("./pdf-renderer");

  // Load source PDF with pdfjs for rendering
  const srcDoc = await loadPdfDocument(originalBytes);
  const pageCount = srcDoc.numPages;

  // Create new PDF document
  const outDoc = await PDFDocument.create();

  // Process each page
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await srcDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: options.dpi / 72 }); // 72 is PDF base DPI

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Render page to canvas
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // Convert canvas to JPEG blob
    const imageBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/jpeg",
        options.jpegQuality
      );
    });

    // Convert blob to array buffer
    const imageBytes = await imageBlob.arrayBuffer();

    // Embed JPEG in PDF
    const jpegImage = await outDoc.embedJpg(imageBytes);

    // Create page with same dimensions as original
    const pdfPage = outDoc.addPage([viewport.width, viewport.height]);
    pdfPage.drawImage(jpegImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
  }

  // Cleanup
  srcDoc.destroy();

  // Save with compression
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

/** Removes document metadata to save space */
function stripMetadata(doc: import("pdf-lib").PDFDocument): void {
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
