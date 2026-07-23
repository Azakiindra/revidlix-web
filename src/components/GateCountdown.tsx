"use client";

import React, { useEffect, useState } from "react";
import { Lock, ShieldCheck, Key, RefreshCw, CheckCircle2 } from "lucide-react";

interface GateCountdownProps {
  currentStep: number;
  stepMessage: string;
}

export const GateCountdown: React.FC<GateCountdownProps> = ({ currentStep, stepMessage }) => {
  const steps = [
    { num: 1, label: "UUID Resolution" },
    { num: 2, label: "View Analytics Track" },
    { num: 3, label: "Play-Info Request" },
    { num: 4, label: "Gate Unlock Countdown" },
    { num: 5, label: "Session Claim JWT" },
    { num: 6, label: "MajorPlay Stream Redeem" },
  ];

  return (
    <div className="w-full glass-panel-glow rounded-2xl p-6 mb-8 border border-cyan-500/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 animate-pulse-glow">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              IDLIX Gate Token Protocol
              <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300 font-mono">
                Step {currentStep} of 6
              </span>
            </h3>
            <p className="text-xs text-slate-400">{stepMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
        </div>
      </div>

      {/* Progress Line & Nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {steps.map((s) => {
          const isDone = s.num < currentStep;
          const isCurrent = s.num === currentStep;

          return (
            <div
              key={s.num}
              className={`flex flex-col p-3 rounded-xl border transition duration-300 ${
                isDone
                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                  : isCurrent
                  ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-500/10"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold">0{s.num}</span>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-700" />
                )}
              </div>
              <span className="text-xs font-medium leading-tight">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
