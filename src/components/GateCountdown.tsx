"use client";

import React from "react";
import { Lock, RefreshCw, CheckCircle2 } from "lucide-react";

interface GateCountdownProps {
  currentStep: number;
  stepMessage: string;
}

export const GateCountdown: React.FC<GateCountdownProps> = ({ currentStep, stepMessage }) => {
  const steps = [
    { num: 1, label: "UUID Resolution" },
    { num: 2, label: "View Analytics" },
    { num: 3, label: "Play-Info Request" },
    { num: 4, label: "Gate Unlock Countdown" },
    { num: 5, label: "Session Claim JWT" },
    { num: 6, label: "Stream Redeem" },
  ];

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-indigo-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              IDLIX Gate Protocol
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-950 text-zinc-400 border border-zinc-800">
                Step {currentStep} of 6
              </span>
            </h3>
            <p className="text-xs text-zinc-400">{stepMessage}</p>
          </div>
        </div>

        <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {steps.map((s) => {
          const isDone = s.num < currentStep;
          const isCurrent = s.num === currentStep;

          return (
            <div
              key={s.num}
              className={`p-2.5 rounded-lg border text-xs transition ${
                isDone
                  ? "bg-zinc-950 border-emerald-500/30 text-emerald-400"
                  : isCurrent
                  ? "bg-zinc-950 border-indigo-500/50 text-indigo-300"
                  : "bg-zinc-950/40 border-zinc-800/60 text-zinc-600"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-semibold opacity-70">0{s.num}</span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                )}
              </div>
              <span className="font-medium text-[11px] leading-tight block">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
