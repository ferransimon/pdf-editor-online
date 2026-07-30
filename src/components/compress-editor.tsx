"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompressionLevel } from "@/lib/pdf-compressor";
import { useI18n } from "@/i18n";

interface CompressEditorProps {
  pdfBytes: ArrayBuffer;
  pdfName: string;
  onBack: () => void;
}

type ProcessingPhase = "idle" | "compressing" | "complete";

export function CompressEditor({ pdfBytes, pdfName, onBack }: CompressEditorProps) {
  const [phase, setPhase] = useState<ProcessingPhase>("idle");
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>("medium");
  const [originalSize, setOriginalSize] = useState<number>(pdfBytes.byteLength);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [compressionRatio, setCompressionRatio] = useState<number>(0);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t } = useI18n();

  // Compress PDF
  const handleCompress = useCallback(async () => {
    setPhase("compressing");
    setError(null);

    try {
      const { compressPdf } = await import("@/lib/pdf-compressor");
      const result = await compressPdf(pdfBytes, { level: compressionLevel });

      setOriginalSize(result.originalSize);
      setCompressedSize(result.compressedSize);
      setCompressionRatio(result.compressionRatio);
      setCompressedBlob(result.blob);
      setPhase("complete");

      // Handle edge case where file grew
      if (result.compressedSize > result.originalSize) {
        setError(t.compress.warningLarger);
      }
    } catch (err) {
      setError(t.compress.errorCompressing);
      setPhase("idle");
      console.error("Compression error:", err);
    }
  }, [pdfBytes, compressionLevel, t]);

  // Download compressed PDF
  const handleDownload = useCallback(() => {
    if (!compressedBlob) return;

    setDownloading(true);
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    const baseName = pdfName.replace(/\.pdf$/i, "");
    a.download = `${baseName}_compressed.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
      setDownloading(false);
    }, 100);
  }, [compressedBlob, pdfName]);

  // Reset to try again
  const handleReset = () => {
    setPhase("idle");
    setCompressedBlob(null);
    setError(null);
  };

  // Render: Compressing
  if (phase === "compressing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-500">{t.compress.compressing}</p>
      </div>
    );
  }

  // Render: Complete
  if (phase === "complete") {
    const savingsBytes = originalSize - compressedSize;
    const isLarger = savingsBytes < 0;

    // Import formatBytes dynamically
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-8 max-w-lg w-full px-8">
          <button
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.compress.back}
          </button>

          <div className="flex flex-col items-center gap-4 text-center w-full">
            <div className="rounded-full bg-green-100 p-4">
              <FileCheck className="h-8 w-8 text-green-600" />
            </div>

            <h2 className="text-2xl font-semibold text-zinc-900">
              {t.compress.compressionComplete}
            </h2>

            {/* Size comparison */}
            <div className="w-full bg-zinc-50 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">{t.compress.originalSize}</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {formatBytes(originalSize)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">{t.compress.compressedSize}</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {formatBytes(compressedSize)}
                </span>
              </div>

              <div className="pt-3 border-t border-zinc-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">
                    {isLarger ? t.compress.increased : t.compress.saved}
                  </span>
                  <span className={`text-lg font-bold ${isLarger ? "text-orange-600" : "text-green-600"}`}>
                    {isLarger ? "+" : "-"}{formatBytes(Math.abs(savingsBytes))}
                    <span className="text-sm ml-1">
                      ({Math.abs(compressionRatio).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 w-full">
                <AlertCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">{error}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              {t.compress.tryAgain}
            </Button>
            <Button onClick={handleDownload} disabled={downloading} className="flex-1">
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.compress.downloading}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t.compress.download}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render: Idle (settings screen)
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-8 max-w-md w-full px-8">
        <button
          onClick={onBack}
          className="self-start flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.compress.back}
        </button>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {t.compress.title}
          </h1>
          <p className="text-sm text-zinc-400">
            {pdfName}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {t.compress.currentSize}: {formatBytes(originalSize)}
          </p>
        </div>

        {/* Compression level selector */}
        <div className="w-full space-y-3">
          <label className="text-sm font-medium text-zinc-700">
            {t.compress.compressionLevel}
          </label>

          <div className="space-y-2">
            {(["low", "medium", "high", "extreme"] as CompressionLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setCompressionLevel(level)}
                className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  compressionLevel === level
                    ? level === "extreme"
                      ? "border-orange-500 bg-orange-50"
                      : "border-zinc-900 bg-zinc-50"
                    : level === "extreme"
                    ? "border-orange-200 hover:border-orange-300 hover:bg-orange-50"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  compressionLevel === level
                    ? level === "extreme"
                      ? "border-orange-600"
                      : "border-zinc-900"
                    : level === "extreme"
                    ? "border-orange-300"
                    : "border-zinc-300"
                }`}>
                  {compressionLevel === level && (
                    <div className={`w-2 h-2 rounded-full ${level === "extreme" ? "bg-orange-600" : "bg-zinc-900"}`} />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className={`font-semibold text-sm ${level === "extreme" ? "text-orange-900" : "text-zinc-900"}`}>
                    {t.compress[`level_${level}` as keyof typeof t.compress]}
                  </div>
                  <div className={`text-xs leading-relaxed ${level === "extreme" ? "text-orange-700" : "text-zinc-500"}`}>
                    {t.compress[`level_${level}_desc` as keyof typeof t.compress]}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Info box */}
        {compressionLevel === "extreme" ? (
          <div className="w-full p-4 rounded-lg bg-orange-50 border border-orange-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-orange-900 mb-1">
                  {t.compress.extremeWarningTitle}
                </p>
                <p className="text-xs text-orange-700 leading-relaxed">
                  {t.compress.extremeWarning}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full p-4 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              {t.compress.infoMessage}
            </p>
          </div>
        )}

        <Button onClick={handleCompress} className="w-full">
          {t.compress.compressButton}
        </Button>
      </div>
    </div>
  );
}
