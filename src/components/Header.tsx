"use client";

import React from "react";
import { Film, Terminal } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="w-full bg-zinc-950 border-b border-zinc-800/80 py-4 px-6 mb-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100">
            <Film className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
                RevIDLIX
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                Web
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              IDLIX Stream Extractor & Multi-threaded Downloader
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Pure TypeScript Engine
          </span>
        </div>
      </div>
    </header>
  );
};
