"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { UrlForm } from "@/components/UrlForm";
import { GateCountdown } from "@/components/GateCountdown";
import { StreamDetails } from "@/components/StreamDetails";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Downloader } from "@/components/Downloader";
import { StreamDataResult, StreamVariant } from "@/lib/idlix-gate";
import { AlertCircle, Film, Sparkles, ShieldAlert, Key, Terminal } from "lucide-react";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [stepMessage, setStepMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCloudflareError, setIsCloudflareError] = useState(false);

  const [streamData, setStreamData] = useState<StreamDataResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<StreamVariant | null>(null);

  const handleResolveUrl = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setIsCloudflareError(false);
    setStreamData(null);
    setSelectedVariant(null);

    setStep(1);
    setStepMessage("Resolving UUID for content...");

    const stepInterval = setInterval(() => {
      setStep((prev) => {
        if (prev < 4) {
          if (prev === 1) setStepMessage("Tracking view analytics...");
          if (prev === 2) setStepMessage("Requesting play-info & gateToken...");
          if (prev === 3) setStepMessage("Waiting unlock countdown...");
          return prev + 1;
        }
        return prev;
      });
    }, 2500);

    try {
      const res = await fetch("/api/gate/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.error || "Gagal memproses stream dari IDLIX.";
        if (res.status === 404 || msg.toLowerCase().includes("cloud")) {
          setIsCloudflareError(true);
        }
        throw new Error(msg);
      }

      setStep(5);
      setStepMessage("Claiming session JWT...");

      const data: StreamDataResult = await res.json();

      setStep(6);
      setStepMessage("Stream resolved successfully!");

      setStreamData(data);
      if (data.variants && data.variants.length > 0) {
        setSelectedVariant(data.variants[0]);
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || "Terjadi kesalahan saat memproses stream.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSubtitle = (url: string, label: string, format: "srt" | "vtt") => {
    const title = streamData?.title || "Subtitle";
    const downloadApiUrl = `/api/subtitle/download?url=${encodeURIComponent(url)}&format=${format}&label=${encodeURIComponent(label)}&title=${encodeURIComponent(title)}`;
    window.open(downloadApiUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pb-16">
        {/* URL Form Component */}
        <UrlForm onSubmitUrl={handleResolveUrl} isLoading={isLoading} />

        {/* Loading / Gate Protocol Progress */}
        {isLoading && <GateCountdown currentStep={step} stepMessage={stepMessage} />}

        {/* Error Alert with Cloudflare Guidance */}
        {error && (
          <div className="w-full p-5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 flex flex-col gap-3 mb-8 shadow-lg shadow-rose-500/10">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-rose-200">Gagal Mengurai Stream IDLIX</h4>
                <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
              </div>
            </div>

            {isCloudflareError && (
              <div className="mt-2 pt-3 border-t border-rose-500/20 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Cloudflare Protection Aktif di z2.idlixku.com</span>
                </div>
                <p className="mb-3 text-slate-300">
                  Cloudflare memblokir permintaan server-side tanpa TLS fingerprint Chromium. Anda dapat menggunakan salah satu dari 2 solusi ini:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="font-bold text-purple-300 flex items-center gap-1.5 mb-1">
                      <Key className="w-3.5 h-3.5" /> 1. Mode Manual GateToken
                    </span>
                    <p className="text-slate-400 text-[11px]">
                      Pilih tab &quot;Manual GateToken&quot; di atas, lalu masukkan <code className="text-purple-300">gateToken</code> yang disalin dari DevTools browser saat membuka IDLIX.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5 mb-1">
                      <Terminal className="w-3.5 h-3.5" /> 2. Jalankan Stealth Go Service
                    </span>
                    <p className="text-slate-400 text-[11px]">
                      Jalankan Stealth microservice di <code className="text-cyan-300">http://localhost:8191</code> agar Cloudflare dapat di-bypass secara otomatis.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stream Results & Download Controls */}
        {streamData && selectedVariant && (
          <div className="flex flex-col gap-8 animate-fadeIn">
            {/* Stream Info & Resolution Picker */}
            <StreamDetails
              data={streamData}
              selectedVariant={selectedVariant}
              onSelectVariant={(v) => setSelectedVariant(v)}
              onDownloadSub={handleDownloadSubtitle}
            />

            {/* Video Player Preview */}
            <VideoPlayer variant={selectedVariant} title={streamData.title || "Stream"} />

            {/* Multi-threaded Downloader */}
            <Downloader variant={selectedVariant} title={streamData.title || "Movie"} />
          </div>
        )}

        {/* Welcome Empty State */}
        {!isLoading && !streamData && !error && (
          <div className="w-full glass-panel rounded-2xl p-12 text-center border border-slate-800 my-8">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
              <Film className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">
              Siap Mengurai Stream IDLIX Tanpa Python
            </h3>
            <p className="text-sm text-slate-400 max-w-xl mx-auto mb-6">
              Masukkan URL IDLIX, Manual GateToken, atau Direct MajorPlay M3U8 URL pada form di atas. Aplikasi ini akan otomatis memproses Gate Token, membuka kunci M3U8, menyediakan player preview, dan pengunduh segmen multi-thread.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Direct Node.js API + Stealth Bypass + In-browser Parallel Downloader
            </div>
          </div>
        )}
      </main>

      <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>RevIDLIX Web Edition — Powered by Next.js & TypeScript</p>
      </footer>
    </div>
  );
}
