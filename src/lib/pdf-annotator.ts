import { PDFDocument, rgb, StandardFonts, LineCapStyle } from "pdf-lib";

// All coordinates normalised to [0, 1] relative to page width/height.
// Y=0 is the TOP of the page (screen convention).

export type DrawStroke = {
  kind: "draw";
  /** Normalised points (x, y) ∈ [0,1]² – origin top-left */
  points: { x: number; y: number }[];
  color: string; // #rrggbb
  /** Normalised line width as fraction of page width */
  normWidth: number;
};

export type TextAnnotation = {
  kind: "text";
  x: number; // normalised
  y: number; // normalised (top of text baseline)
  text: string;
  /** Font size in pt — stored at capture time */
  fontSize: number;
  color: string;
};

export type RectAnnotation = {
  kind: "rect";
  x: number; // normalised top-left
  y: number;
  w: number;
  h: number;
  color: string;
};

export type Annotation = DrawStroke | TextAnnotation | RectAnnotation;

// ── helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Embed annotations into a copy of the PDF and return the result as a Blob.
 * @param originalBytes  Source PDF ArrayBuffer
 * @param pageAnnotations  Map<pageIndex (0-based), Annotation[]>
 */
export async function applyAnnotations(
  originalBytes: ArrayBuffer,
  pageAnnotations: Map<number, Annotation[]>
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(originalBytes.slice(0));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const [pageIdx, annotations] of pageAnnotations.entries()) {
    const page = pages[pageIdx];
    if (!page || !annotations.length) continue;

    const { width: pw, height: ph } = page.getSize();

    for (const ann of annotations) {
      // Screen Y (0=top) → PDF Y (0=bottom): pdfY = ph - normY * ph
      if (ann.kind === "draw") {
        if (ann.points.length < 2) continue;

        // Use drawLine for each segment (reliable, no coordinate system ambiguity)
        for (let i = 0; i < ann.points.length - 1; i++) {
          const ax = ann.points[i].x * pw;
          const ay = ph - ann.points[i].y * ph;
          const bx = ann.points[i + 1].x * pw;
          const by = ph - ann.points[i + 1].y * ph;
          page.drawLine({
            start: { x: ax, y: ay },
            end: { x: bx, y: by },
            color: hexToRgb(ann.color),
            thickness: Math.max(0.5, ann.normWidth * pw),
            lineCap: LineCapStyle.Round,
          });
        }
      } else if (ann.kind === "text") {
        const x = ann.x * pw;
        // PDF text origin is baseline bottom-left; subtract fontSize to move anchor to top
        const baseY = ph - ann.y * ph - ann.fontSize;
        const lines = ann.text.split("\n");
        lines.forEach((line, i) => {
          const y = baseY - i * ann.fontSize * 1.25;
          page.drawText(line, {
            x: Math.max(0, x),
            y: Math.max(0, y),
            size: ann.fontSize,
            font,
            color: hexToRgb(ann.color),
          });
        });
      } else if (ann.kind === "rect") {
        const x = ann.x * pw;
        const y = ph - ann.y * ph - ann.h * ph;
        const w = ann.w * pw;
        const h = ann.h * ph;
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          borderColor: hexToRgb(ann.color),
          borderWidth: 2,
          color: hexToRgb(ann.color),
          opacity: 0.15,
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  const blobData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([blobData], { type: "application/pdf" });
}
