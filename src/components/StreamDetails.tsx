"use client";

import React from "react";
import { Clock, Monitor, Subtitles, Check, Music } from "lucide-react";
import { StreamDataResult, StreamVariant } from "@/lib/idlix-gate";

interface StreamDetailsProps {
  data: StreamDataResult;
  selectedVariant: StreamVariant | null;
  onSelectVariant: (variant: StreamVariant) => void;
  onDownloadSub: (url: string, label: string, format: "srt" | "vtt") => void;
}

export const StreamDetails: React.FC<StreamDetailsProps> = ({
  data,
  selectedVariant,
  onSelectVariant,
  onDownloadSub,
}) => {
  const formatDuration = (sec: number | null) => {
    if (!sec) return "Unknown";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-950 text-indigo-400 border border-zinc-800">
              Unlocked Stream
            </span>
            {data.maxHeight && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-950 text-zinc-400 border border-zinc-800">
                Max {data.maxHeight}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            {data.title || "Stream Video"}
          </h2>
        </div>

        <div className="flex items-center gap-3 text-zinc-300 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>{formatDuration(data.durationSec)}</span>
          </div>

          {data.audioPlaylistUrl && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-400">
              <Music className="w-3.5 h-3.5" />
              <span>Dual Audio</span>
            </div>
          )}
        </div>
      </div>

      {/* Resolution Variant Selector */}
      <div className="my-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2 mb-3">
          <Monitor className="w-4 h-4 text-indigo-400" />
          Pilih Resolusi Stream & Download:
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {data.variants.map((v, idx) => {
            const isSelected = selectedVariant?.url === v.url;
            const mbps = v.bandwidth ? (v.bandwidth / 1000000).toFixed(2) : "Auto";

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectVariant(v)}
                className={`flex items-center justify-between p-3 rounded-lg border text-left transition ${
                  isSelected
                    ? "bg-zinc-950 border-indigo-500 text-zinc-100"
                    : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-400"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-zinc-100">{v.height}</span>
                    <span className="text-xs text-zinc-500">({v.resolution})</span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">Bitrate: {mbps} Mbps</div>
                </div>

                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "border-zinc-800 text-transparent"
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtitle Downloads */}
      {data.subtitles && data.subtitles.length > 0 && (
        <div className="pt-4 border-t border-zinc-800">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2 mb-3">
            <Subtitles className="w-4 h-4 text-indigo-400" />
            Tersedia Subtitle ({data.subtitles.length}):
          </label>

          <div className="flex flex-wrap gap-2">
            {data.subtitles.map((sub, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
              >
                <span>{sub.label}</span>
                <div className="flex items-center gap-1 ml-1.5">
                  <button
                    type="button"
                    onClick={() => onDownloadSub(sub.url, sub.label, "srt")}
                    className="px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-mono text-[11px] transition"
                  >
                    .SRT
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadSub(sub.url, sub.label, "vtt")}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] transition"
                  >
                    .VTT
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
