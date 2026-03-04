export interface PdfFile {
  name: string;
  bytes: ArrayBuffer;
}

export async function openPdfFile(): Promise<PdfFile> {
  // Try File System Access API first
  if ("showOpenFilePicker" in window) {
    try {
      const [fileHandle] = await (window as Window & typeof globalThis & {
        showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]>;
      }).showOpenFilePicker({
        types: [
          {
            description: "PDF",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
        multiple: false,
      });
      const file = await fileHandle.getFile();
      const bytes = await file.arrayBuffer();
      return { name: file.name, bytes };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      // Fall through to input fallback
    }
  }

  // Fallback: hidden file input
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      const bytes = await file.arrayBuffer();
      resolve({ name: file.name, bytes });
    };
    input.click();
  });
}
