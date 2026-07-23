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
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
      {/* Mode Tabs */}
      <div className="flex items-center gap-1.5 mb-5 p-1 bg-zinc-950 rounded-lg border border-zinc-800/80 w-fit">
        <button
          type="button"
          onClick={() => { setInputMode("url"); setUrlInput(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition ${
            inputMode === "url"
              ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>URL / Slug</span>
        </button>

        <button
          type="button"
          onClick={() => { setInputMode("token"); setUrlInput(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition ${
            inputMode === "token"
              ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Manual GateToken</span>
        </button>

        <button
          type="button"
          onClick={() => { setInputMode("m3u8"); setUrlInput(""); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition ${
            inputMode === "m3u8"
              ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Direct M3U8</span>
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {inputMode === "url" && "Masukkan URL / Slug IDLIX:"}
            {inputMode === "token" && "Masukkan Manual GateToken:"}
            {inputMode === "m3u8" && "Masukkan Direct M3U8 Stream URL:"}
          </label>

          {parsed && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-indigo-300">
              {parsed.contentType === "episode" ? (
                <>
                  <Tv className="w-3 h-3 text-indigo-400" />
                  <span>Series: {parsed.slug} (S{parsed.season}E{parsed.episode})</span>
                </>
              ) : parsed.contentType === "series" ? (
                <>
                  <Tv className="w-3 h-3 text-indigo-400" />
                  <span>Series: {parsed.slug}</span>
                </>
              ) : (
                <>
                  <Film className="w-3 h-3 text-indigo-400" />
                  <span>Movie: {parsed.slug}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={
                inputMode === "url"
                  ? "https://z2.idlixku.com/movie/the-conjuring-2013"
                  : inputMode === "token"
                  ? "Tempel gateToken dari DevTools..."
                  : "https://e2e.majorplay.net/v/.../master.m3u8"
              }
              disabled={isLoading}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm placeholder:text-zinc-600 transition disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={handlePaste}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-sm font-medium transition disabled:opacity-50"
          >
            <Clipboard className="w-4 h-4 text-zinc-400" />
            <span>Paste</span>
          </button>

          <button
            type="submit"
            disabled={!urlInput.trim() || isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Resolve</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Info & Helper Snippet */}
        {inputMode === "token" && (
          <div className="mt-1 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Jalankan snippet ini di DevTools Console (F12) saat menonton IDLIX untuk menyalin `gateToken`:
              </span>
            </div>
            <button
              type="button"
              onClick={copyDevToolsSnippet}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-mono text-xs shrink-0 transition"
            >
              {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet ? "Copied" : "Copy Snippet"}</span>
            </button>
          </div>
        )}

        {inputMode === "url" && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-xs text-zinc-500">
            <span>Contoh:</span>
            <button
              type="button"
              onClick={() => handleSample("the-conjuring-2013")}
              className="px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition font-mono"
            >
              the-conjuring-2013
            </button>
            <button
              type="button"
              onClick={() => handleSample("stranger-things/season/1/episode/1")}
              className="px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition font-mono"
            >
              stranger-things S1E1
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
