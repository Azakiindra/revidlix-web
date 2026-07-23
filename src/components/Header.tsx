"use client";

import React from "react";
import { Film, Zap, Globe, Sparkles } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="w-full glass-panel border-b border-cyan-500/20 py-4 px-6 mb-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 tracking-tight">
                RevIDLIX Web
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Next.js v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              Web Edition — Direct IDLIX Stream, Player & Multi-threaded Downloader
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Zap className="w-4 h-4" />
            <span>Zero Python Required</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>50x Parallel Threads</span>
          </div>
        </div>
      </div>
    </header>
  );
};
