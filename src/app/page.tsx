"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { UrlForm } from "@/components/UrlForm";
import { GateCountdown } from "@/components/GateCountdown";
import { StreamDetails } from "@/components/StreamDetails";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Downloader } from "@/components/Downloader";
import { StreamDataResult, StreamVariant } from "@/lib/idlix-gate";
import { executeClientSideGateFlow } from "@/lib/client-gate-resolver";
import { AlertCircle, Film, ShieldAlert, Key, Terminal } from "lucide-react";

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

    let isResolved = false;

    // 1. Try Vercel Python Serverless Function first (/api/resolve)
    try {
      const pyRes = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (pyRes.ok) {
        clearInterval(stepInterval);
        setStep(5);
        setStepMessage("Claiming session JWT...");
        const data: StreamDataResult = await pyRes.json();
        setStep(6);
        setStepMessage("Stream resolved via Python Engine!");
        setStreamData(data);
        if (data.variants && data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
        isResolved = true;
      }
    } catch {
      // Fallthrough to Node / Browser Engine
    }

    if (isResolved) {
      setIsLoading(false);
      return;
    }

    // 2. Try Node.js API (/api/gate/resolve)
    try {
      const res = await fetch("/api/gate/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        clearInterval(stepInterval);
        setStep(5);
        setStepMessage("Claiming session JWT...");
        const data: StreamDataResult = await res.json();
        setStep(6);
        setStepMessage("Stream resolved successfully!");
        setStreamData(data);
        if (data.variants && data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
        isResolved = true;
      }
    } catch {
      // Fallthrough to Browser Client Engine
    }

    if (isResolved) {
      setIsLoading(false);
      return;
    }

    // 3. Fallback: Run Browser Client Engine directly in user's browser
    setStepMessage("Running Browser Engine for Cloudflare Bypass...");
    try {
      const clientData = await executeClientSideGateFlow(url, (stepNum, msg) => {
        setStep(stepNum);
        setStepMessage(msg);
      });

      clearInterval(stepInterval);

      if (clientData && clientData.variants && clientData.variants.length > 0) {
        setStep(6);
        setStepMessage("Stream resolved via Browser Engine!");
        setStreamData(clientData);
        setSelectedVariant(clientData.variants[0]);
      } else {
        setIsCloudflareError(true);
        throw new Error("Gagal memproses stream dari IDLIX. Pastikan URL film/series valid.");
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-16">
        {/* URL Form Component */}
        <UrlForm onSubmitUrl={handleResolveUrl} isLoading={isLoading} />

        {/* Loading / Gate Protocol Progress */}
        {isLoading && <GateCountdown currentStep={step} stepMessage={stepMessage} />}

        {/* Error Alert with Guidance */}
        {error && (
          <div className="w-full p-4 rounded-xl bg-zinc-900 border border-rose-500/40 text-rose-300 flex flex-col gap-3 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-rose-200">Gagal Mengurai Stream IDLIX</h4>
                <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
              </div>
            </div>

            {isCloudflareError && (
              <div className="mt-1 pt-3 border-t border-rose-500/20 text-xs text-zinc-300">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300 mb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Petunjuk Penanganan:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="font-semibold text-zinc-200 flex items-center gap-1.5 mb-1 text-xs">
                      <Key className="w-3.5 h-3.5 text-indigo-400" /> Mode Manual GateToken
                    </span>
                    <p className="text-zinc-400 text-[11px]">
                      Gunakan tab &quot;Manual GateToken&quot; pada form di atas, lalu tempel <code className="text-indigo-300">gateToken</code> dari DevTools browser.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="font-semibold text-zinc-200 flex items-center gap-1.5 mb-1 text-xs">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Direct M3U8
                    </span>
                    <p className="text-zinc-400 text-[11px]">
                      Pastikan URL film/series valid atau coba tempel langsung link stream `.m3u8` di tab Direct M3U8.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stream Results & Download Controls */}
        {streamData && selectedVariant && (
          <div className="flex flex-col gap-6">
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
          <div className="w-full bg-zinc-900 rounded-xl p-10 text-center border border-zinc-800 my-6">
            <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <Film className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">
              IDLIX Stream Extractor & Downloader
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mb-4">
              Tempel URL IDLIX, Manual GateToken, atau Direct MajorPlay M3U8 URL di atas untuk mengurai stream, memutar preview video, dan mengunduh MP4 secara langsung.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              Vercel Native Python Engine (requests.Session) + Next.js — 100% Ready
            </div>
          </div>
        )}
      </main>

      <footer className="w-full border-t border-zinc-800/80 py-4 text-center text-xs font-mono text-zinc-500">
        <p>RevIDLIX Web — Minimalist Flat Design Edition</p>
      </footer>
    </div>
  );
}
