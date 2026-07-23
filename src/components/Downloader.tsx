"use client";

import React, { useState, useRef } from "react";
import { Download, Sliders, Copy, Terminal } from "lucide-react";
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
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-400" />
            In-Browser Parallel Downloader
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Unduh segmen HLS secara langsung di memori browser dan simpan sebagai MP4.
          </p>
        </div>

        {/* Thread Slider */}
        <div className="flex items-center gap-2.5 bg-zinc-950 p-2 px-3 rounded-lg border border-zinc-800 w-fit">
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-300 font-mono">
              Threads: <span className="text-indigo-400 font-bold">{threads}</span>
            </span>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              disabled={isDownloading}
              className="w-24 accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Progress Card */}
      {progress.total > 0 && (
        <div className="mb-5 p-4 rounded-lg bg-zinc-950 border border-zinc-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-zinc-200">{progress.statusText}</span>
            <span className="font-mono text-indigo-400 font-semibold">{pct.toFixed(1)}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800 mb-3">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-zinc-400">
            <div>Segmen: <span className="text-zinc-200">{progress.downloaded} / {progress.total}</span></div>
            <div>Ukuran: <span className="text-zinc-200">{sizeMb} MB</span></div>
            <div>Kecepatan: <span className="text-indigo-400 font-semibold">{progress.speedMb.toFixed(2)} MB/s</span></div>
            <div>Waktu: <span className="text-zinc-200">{progress.elapsedSec.toFixed(0)}s</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <button
        type="button"
        onClick={handleStartDownload}
        disabled={isDownloading}
        className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition disabled:opacity-50"
      >
        {isDownloading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Mengunduh Segmen ({pct.toFixed(0)}%)...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Mulai Download MP4 ({variant.height})</span>
          </>
        )}
      </button>

      {/* FFmpeg Power User Box */}
      <div className="mt-5 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            FFmpeg Command (Power User):
          </span>
          <button
            type="button"
            onClick={copyFfmpegCmd}
            className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white font-mono bg-zinc-950 px-2 py-1 rounded border border-zinc-800 transition"
          >
            <Copy className="w-3 h-3 text-zinc-400" />
            {copiedCmd ? "Copied" : "Copy Command"}
          </button>
        </div>
        <div className="p-3 rounded bg-zinc-950 font-mono text-xs text-zinc-400 border border-zinc-800/80 overflow-x-auto whitespace-nowrap">
          {ffmpegCommand}
        </div>
      </div>
    </div>
  );
};
