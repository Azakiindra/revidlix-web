"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Volume2, VolumeX, Maximize, Tv } from "lucide-react";
import { StreamVariant } from "@/lib/idlix-gate";

interface VideoPlayerProps {
  variant: StreamVariant;
  title: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ variant, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !variant) return;

    setError(null);
    const proxiedM3u8Url = `/api/proxy/m3u8?url=${encodeURIComponent(variant.url)}`;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(proxiedM3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Ready to play
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              setError("Fatal video playback error");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = proxiedM3u8Url;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [variant]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Tv className="w-4 h-4 text-indigo-400" />
          Live Stream Player Preview
          <span className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-300 text-[11px] font-mono border border-zinc-800">
            {variant.height}
          </span>
        </h3>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-zinc-400" />}
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative w-full aspect-video rounded-lg bg-zinc-950 overflow-hidden border border-zinc-800 flex items-center justify-center">
        {error ? (
          <div className="text-center p-6 text-rose-400 text-xs font-mono">
            <p>{error}</p>
            <p className="text-zinc-500 mt-1">Gunakan pengunduh segmen di bawah untuk mengunduh file MP4 secara langsung.</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            controls
            playsInline
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
      </div>
    </div>
  );
};
