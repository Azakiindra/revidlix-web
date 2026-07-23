"use client";

import React from "react";
import { Film, Clock, Monitor, Download, Subtitles, Check, Music } from "lucide-react";
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
    <div className="w-full glass-panel rounded-2xl p-6 mb-8 border border-slate-800">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              IDLIX Unlocked
            </span>
            {data.maxHeight && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Max {data.maxHeight}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
            {data.title || "Stream Video"}
          </h2>
        </div>

        <div className="flex items-center gap-4 text-slate-300 text-sm font-medium">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>{formatDuration(data.durationSec)}</span>
          </div>

          {data.audioPlaylistUrl && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Music className="w-4 h-4" />
              <span>Dual-Track Audio</span>
            </div>
          )}
        </div>
      </div>

      {/* Resolution Variant Selector */}
      <div className="my-6">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
          <Monitor className="w-4 h-4 text-cyan-400" />
          Pilih Resolusi Stream & Download:
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.variants.map((v, idx) => {
            const isSelected = selectedVariant?.url === v.url;
            const mbps = v.bandwidth ? (v.bandwidth / 1000000).toFixed(2) : "Auto";

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectVariant(v)}
                className={`flex items-center justify-between p-4 rounded-xl border text-left transition duration-200 ${
                  isSelected
                    ? "bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border-cyan-400 text-slate-100 shadow-lg shadow-cyan-500/10"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-cyan-400">{v.height}</span>
                    <span className="text-xs text-slate-400">({v.resolution})</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Bitrate: {mbps} Mbps</div>
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                    isSelected
                      ? "bg-cyan-500 border-cyan-400 text-slate-950"
                      : "border-slate-700 text-transparent"
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtitle Downloads */}
      {data.subtitles && data.subtitles.length > 0 && (
        <div className="pt-6 border-t border-slate-800">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
            <Subtitles className="w-4 h-4 text-purple-400" />
            Tersedia Subtitle ({data.subtitles.length}):
          </label>

          <div className="flex flex-wrap gap-2">
            {data.subtitles.map((sub, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200"
              >
                <span>{sub.label}</span>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => onDownloadSub(sub.url, sub.label, "srt")}
                    className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-mono transition"
                  >
                    .SRT
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadSub(sub.url, sub.label, "vtt")}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
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
