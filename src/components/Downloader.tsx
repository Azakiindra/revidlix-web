"use client";

import React, { useState, useRef } from "react";
import { Download, Sliders, Play, CheckCircle2, Copy, Terminal, AlertTriangle, FileVideo, Sparkles } from "lucide-react";
import { StreamVariant } from "@/lib/idlix-gate";
import { parseSegmentsFromM3u8, fetchM3u8Text } from "@/lib/idlix-gate";

interface DownloaderProps {
  variant: StreamVariant;
  title: string;
}

export const Downloader: React.FC<DownloaderProps> = ({ variant, title }) => {
  const [threads, setThreads] = useState<number>(20);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<{
    downloaded: number;
    total: number;
    speedMb: number;
    bytesTotal: number;
    elapsedSec: number;
    statusText: string;
  }>({
    downloaded: 0,
    total: 0,
    speedMb: 0,
    bytesTotal: 0,
    elapsedSec: 0,
    statusText: "Ready",
  });

  const [copiedCmd, setCopiedCmd] = useState(false);
  const isCancelledRef = useRef(false);

  const ffmpegCommand = `ffmpeg -headers "User-Agent: Mozilla/5.0 (Linux; Android 6.0)\r\nReferer: https://z2.idlixku.com/\r\n" -i "${variant.url}" -c copy -movflags +faststart "${title.replace(/[\\/*?:"<>| ]/g, "_")}.mp4"`;

  const copyFfmpegCmd = () => {
    navigator.clipboard.writeText(ffmpegCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleStartDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    isCancelledRef.current = false;
    setProgress({
      downloaded: 0,
      total: 0,
      speedMb: 0,
      bytesTotal: 0,
      elapsedSec: 0,
      statusText: "Fetching segment playlist...",
    });

    const startTime = Date.now();

    try {
      // 1. Fetch variant M3U8 text
      const m3u8Text = await fetchM3u8Text(variant.url);
      if (!m3u8Text) {
        throw new Error("Failed to fetch playlist M3U8");
      }

      const { segments, initUrl } = parseSegmentsFromM3u8(m3u8Text, variant.url);
      const totalSegs = segments.length;

      if (totalSegs === 0) {
        throw new Error("No video segments found in manifest");
      }

      setProgress((p) => ({ ...p, total: totalSegs, statusText: `Downloading ${totalSegs} segments...` }));

      const chunksMap = new Map<number, Uint8Array>();
      let downloadedCount = 0;
      let totalBytesReceived = 0;

      // 2. Fetch init segment if present
      if (initUrl) {
        try {
          const initRes = await fetch(`/api/proxy/segment?url=${encodeURIComponent(initUrl)}`);
          if (initRes.ok) {
            const buf = await initRes.arrayBuffer();
            chunksMap.set(-1, new Uint8Array(buf));
            totalBytesReceived += buf.byteLength;
          }
        } catch {
          // Continue if init segment fetch fails
        }
      }

      // 3. Multi-threaded worker queue
      let activeIndex = 0;

      const worker = async () => {
        while (activeIndex < totalSegs && !isCancelledRef.current) {
          const index = activeIndex++;
          const segUrl = segments[index];

          let success = false;
          let retries = 3;

          while (retries > 0 && !success && !isCancelledRef.current) {
            try {
              const res = await fetch(`/api/proxy/segment?url=${encodeURIComponent(segUrl)}`);
              if (res.ok) {
                const buf = await res.arrayBuffer();
                const u8 = new Uint8Array(buf);
                chunksMap.set(index, u8);
                totalBytesReceived += u8.byteLength;
                downloadedCount++;
                success = true;
              } else {
                retries--;
              }
            } catch {
              retries--;
            }
          }

          const elapsedSec = (Date.now() - startTime) / 1000;
          const speedMb = elapsedSec > 0 ? totalBytesReceived / (1024 * 1024 * elapsedSec) : 0;

          setProgress((p) => ({
            ...p,
            downloaded: downloadedCount,
            bytesTotal: totalBytesReceived,
            speedMb,
            elapsedSec,
            statusText: `Downloading: ${downloadedCount}/${totalSegs} segments (${((downloadedCount / totalSegs) * 100).toFixed(1)}%)`,
          }));
        }
      };

      // Launch parallel threads
      const pool = Array.from({ length: Math.min(threads, totalSegs) }, () => worker());
      await Promise.all(pool);

      if (isCancelledRef.current) {
        setProgress((p) => ({ ...p, statusText: "Download cancelled" }));
        setIsDownloading(false);
        return;
      }

      // 4. Merge chunks into single Blob and trigger browser download
      setProgress((p) => ({ ...p, statusText: "Merging segments & preparing file download..." }));

      const orderedChunks: Uint8Array[] = [];
      if (chunksMap.has(-1)) {
        orderedChunks.push(chunksMap.get(-1)!);
      }
      for (let i = 0; i < totalSegs; i++) {
        if (chunksMap.has(i)) {
          orderedChunks.push(chunksMap.get(i)!);
        }
      }

      const combinedBlob = new Blob(orderedChunks as BlobPart[], { type: "video/mp4" });
      const downloadUrl = URL.createObjectURL(combinedBlob);

      const a = document.createElement("a");
      a.href = downloadUrl;
      const safeName = title.replace(/[\\/*?:"<>| ]/g, "_") + `_${variant.height}.mp4`;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setProgress((p) => ({
        ...p,
        statusText: `✓ Download Complete! Saved as ${safeName}`,
      }));
    } catch (err: any) {
      setProgress((p) => ({
        ...p,
        statusText: `✗ Error: ${err.message || "Failed to download segments"}`,
      }));
    } finally {
      setIsDownloading(false);
    }
  };

  const pct = progress.total > 0 ? (progress.downloaded / progress.total) * 100 : 0;
  const sizeMb = (progress.bytesTotal / (1024 * 1024)).toFixed(1);

  return (
    <div className="w-full glass-panel rounded-2xl p-6 border border-slate-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-400" />
            In-Browser Multi-threaded Downloader
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Unduh segmen HLS secara paralel di memori browser dan simpan sebagai MP4 tanpa Python.
          </p>
        </div>

        {/* Thread Slider */}
        <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-xs text-slate-300 font-semibold">
              Threads: <span className="text-cyan-400">{threads}</span>
            </span>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              disabled={isDownloading}
              className="w-32 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Progress Card */}
      {progress.total > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-slate-200">{progress.statusText}</span>
            <span className="font-mono text-xs text-cyan-400">{pct.toFixed(1)}%</span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800 mb-3">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 progress-animated transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-400">
            <div>Segmen: <span className="text-slate-200">{progress.downloaded} / {progress.total}</span></div>
            <div>Ukuran: <span className="text-slate-200">{sizeMb} MB</span></div>
            <div>Kecepatan: <span className="text-cyan-400">{progress.speedMb.toFixed(2)} MB/s</span></div>
            <div>Waktu: <span className="text-slate-200">{progress.elapsedSec.toFixed(0)}s</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleStartDownload}
          disabled={isDownloading}
          className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-base shadow-lg shadow-cyan-500/20 transition duration-200 disabled:opacity-50"
        >
          {isDownloading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Mengunduh Segmen ({pct.toFixed(0)}%)...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Mulai Download MP4 ({variant.height})</span>
            </>
          )}
        </button>
      </div>

      {/* FFmpeg Power User Box */}
      <div className="mt-6 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            Opsi FFmpeg Terminal (Power User):
          </span>
          <button
            type="button"
            onClick={copyFfmpegCmd}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20 transition"
          >
            <Copy className="w-3 h-3" />
            {copiedCmd ? "Copied!" : "Copy Command"}
          </button>
        </div>
        <div className="p-3 rounded-lg bg-slate-950 font-mono text-xs text-slate-400 border border-slate-800/80 overflow-x-auto whitespace-nowrap">
          {ffmpegCommand}
        </div>
      </div>
    </div>
  );
};
