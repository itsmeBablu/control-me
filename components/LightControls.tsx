"use client";

import SoundEngine from "./SoundEngine";

interface LightsState {
  headlights: boolean;
  hazards: boolean;
  neon: boolean;
}

interface LightControlsProps {
  lightsState: LightsState;
  onChange: (updater: (prev: LightsState) => LightsState) => void;
}

export default function LightControls({
  lightsState,
  onChange,
}: LightControlsProps) {

  const toggleHeadlights = () => {
    SoundEngine.playClick(1100, 0.03, 0.05);
    onChange((prev) => ({ ...prev, headlights: !prev.headlights }));
  };

  const toggleHazards = () => {
    const nextState = !lightsState.hazards;
    SoundEngine.playClick(900, 0.03, 0.05);
    SoundEngine.setBlinkers(nextState);
    onChange((prev) => ({ ...prev, hazards: nextState }));
  };

  const toggleNeon = () => {
    SoundEngine.playClick(1000, 0.03, 0.05);
    onChange((prev) => ({ ...prev, neon: !prev.neon }));
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-900/30 border border-zinc-800/40 rounded-2xl select-none text-left">
      <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-widest block mb-1">
        SYS LIGHTING & LIGHT CODES
      </span>

      <div className="grid grid-cols-3 gap-2">
        {/* Headlights Switch */}
        <button
          onClick={toggleHeadlights}
          className={`py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[9px] font-bold transition-all duration-300 cursor-pointer ${
            lightsState.headlights
              ? "bg-cyan-950/20 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          }`}
        >
          <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707" />
          </svg>
          HEADS: {lightsState.headlights ? "ON" : "OFF"}
        </button>

        {/* Hazards Switch */}
        <button
          onClick={toggleHazards}
          className={`py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[9px] font-bold transition-all duration-300 cursor-pointer ${
            lightsState.hazards
              ? "bg-amber-950/20 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          }`}
        >
          <svg className="w-4 h-4 fill-none stroke-current animate-pulse" viewBox="0 0 24 24" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          HAZARDS
        </button>

        {/* Neon Underglow Switch */}
        <button
          onClick={toggleNeon}
          className={`py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[9px] font-bold transition-all duration-300 cursor-pointer ${
            lightsState.neon
              ? "bg-porsche-yellow/15 border-porsche-yellow text-porsche-yellow shadow-[0_0_12px_rgba(242,211,41,0.3)]"
              : "bg-zinc-950/40 border-zinc-800/80 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          }`}
        >
          <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          NEON: {lightsState.neon ? "ACTIVE" : "OFF"}
        </button>
      </div>
    </div>
  );
}
