"use client";

import React, { useState } from "react";
import { Link2, Clipboard, ArrowRight, Tv, Film, Key, Radio, Copy, Check, Info } from "lucide-react";
import { parseIdlixUrl } from "@/lib/idlix-gate";

interface UrlFormProps {
  onSubmitUrl: (url: string) => void;
  isLoading: boolean;
}

export const UrlForm: React.FC<UrlFormProps> = ({ onSubmitUrl, isLoading }) => {
  const [inputMode, setInputMode] = useState<"url" | "token" | "m3u8">("url");
  const [urlInput, setUrlInput] = useState("");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const parsed = urlInput.trim() && inputMode === "url" ? parseIdlixUrl(urlInput) : null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
      }
    } catch {
      // Clipboard blocked
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim() && !isLoading) {
      onSubmitUrl(urlInput.trim());
    }
  };

  const handleSample = (sampleUrl: string) => {
    setUrlInput(sampleUrl);
    onSubmitUrl(sampleUrl);
  };

  const devToolsSnippet = `copy(JSON.parse(sessionStorage.getItem('playInfo')||'{}').gateToken || ''); alert('GateToken Copied!');`;

  const copyDevToolsSnippet = () => {
    navigator.clipboard.writeText(devToolsSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  return (
    <div className="w-full glass-panel rounded-2xl p-6 mb-8 border border-slate-800">
      {/* Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => { setInputMode("url"); setUrlInput(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            inputMode === "url"
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>IDLIX URL / Slug</span>
        </button>

        <button
          type="button"
          onClick={() => { setInputMode("token"); setUrlInput(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            inputMode === "token"
              ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Manual GateToken</span>
        </button>

        <button
          type="button"
          onClick={() => { setInputMode("m3u8"); setUrlInput(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            inputMode === "m3u8"
              ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Direct MajorPlay M3U8</span>
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            {inputMode === "url" && <Link2 className="w-4 h-4 text-cyan-400" />}
            {inputMode === "token" && <Key className="w-4 h-4 text-purple-400" />}
            {inputMode === "m3u8" && <Radio className="w-4 h-4 text-emerald-400" />}
            {inputMode === "url" && "Masukkan URL IDLIX atau Content Slug:"}
            {inputMode === "token" && "Masukkan GateToken (dari Browser DevTools):"}
            {inputMode === "m3u8" && "Masukkan Direct Stream M3U8 URL (majorplay.net):"}
          </label>

          {parsed && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300">
              {parsed.contentType === "episode" ? (
                <>
                  <Tv className="w-3.5 h-3.5 text-purple-400" />
                  <span>Series: {parsed.slug} (S{parsed.season}E{parsed.episode})</span>
                </>
              ) : parsed.contentType === "series" ? (
                <>
                  <Tv className="w-3.5 h-3.5 text-purple-400" />
                  <span>Series: {parsed.slug}</span>
                </>
              ) : (
                <>
                  <Film className="w-3.5 h-3.5 text-blue-400" />
                  <span>Movie: {parsed.slug}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={
                inputMode === "url"
                  ? "https://z2.idlixku.com/movie/the-conjuring-2013"
                  : inputMode === "token"
                  ? "Paste gateToken dari DevTools..."
                  : "https://e2e.majorplay.net/v/.../master.m3u8"
              }
              disabled={isLoading}
              className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3.5 text-slate-100 text-sm placeholder:text-slate-500 transition duration-200 disabled:opacity-50 pr-10"
            />
          </div>

          <button
            type="button"
            onClick={handlePaste}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition duration-200 disabled:opacity-50"
          >
            <Clipboard className="w-4 h-4 text-cyan-400" />
            <span>Paste</span>
          </button>

          <button
            type="submit"
            disabled={!urlInput.trim() || isLoading}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/25 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Resolve Stream</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Info & Helper Snippet */}
        {inputMode === "token" && (
          <div className="mt-2 p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                Buka DevTools Console (F12) saat menonton IDLIX, lalu jalankan helper snippet ini untuk menyalin `gateToken`:
              </span>
            </div>
            <button
              type="button"
              onClick={copyDevToolsSnippet}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-mono shrink-0 transition"
            >
              {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet ? "Copied!" : "Copy Helper"}</span>
            </button>
          </div>
        )}

        {inputMode === "url" && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
            <span className="text-slate-500">Contoh Cepat:</span>
            <button
              type="button"
              onClick={() => handleSample("the-conjuring-2013")}
              className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 transition"
            >
              Movie: the-conjuring-2013
            </button>
            <button
              type="button"
              onClick={() => handleSample("stranger-things/season/1/episode/1")}
              className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 transition"
            >
              Episode: S1E1
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
