"use client";

import { useEffect, useRef } from "react";
import SoundEngine from "./SoundEngine";

interface ConnectionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  ipAddress: string;
  setIpAddress: (ip: string) => void;
  connMode: "ws" | "http";
  setConnMode: (mode: "ws" | "http") => void;
  status: string;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  logs: string[];
  onClearLogs: () => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
}

export default function ConnectionSettings({
  isOpen,
  onClose,
  ipAddress,
  setIpAddress,
  connMode,
  setConnMode,
  status,
  connected,
  onConnect,
  onDisconnect,
  logs,
  onClearLogs,
  soundMuted,
  setSoundMuted,
}: ConnectionSettingsProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        SoundEngine.playClick();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      {/* Background click dismiss */}
      <div 
        className="absolute inset-0 cursor-default" 
        onClick={() => {
          SoundEngine.playClick();
          onClose();
        }}
      />

      {/* ECU Setup Box */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border-2 border-porsche-yellow/40 carbon-fiber shadow-[0_0_30px_rgba(242,211,41,0.25)] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Yellow stitched top border accent */}
        <div className="h-1.5 w-full bg-porsche-yellow bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[size:10px_10px]" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-5">
            <div className="text-left">
              <h2 className="text-sm font-black tracking-widest text-porsche-yellow font-mono text-glow-yellow">
                PORSCHE COCKPIT ECU TERMINAL
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono tracking-wider mt-0.5">WIFI CONFIGURATION & DIALS SETUP</p>
            </div>
            <button 
              onClick={() => {
                SoundEngine.playClick();
                onClose();
              }}
              className="p-1 text-zinc-400 hover:text-porsche-yellow transition-colors font-bold font-mono text-xs border border-zinc-800 hover:border-porsche-yellow/50 rounded bg-zinc-950/60 px-2 cursor-pointer"
            >
              ESC CLOSE
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {/* Left side: Form */}
            <div className="flex flex-col gap-4 text-left">
              {/* IP Input */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1 tracking-wider uppercase">
                  CAR WIFI IP ADDRESS
                </label>
                <input 
                  type="text" 
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.4.1"
                  className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-porsche-yellow rounded-lg px-3 py-2 font-mono text-sm text-zinc-200 outline-none transition-colors"
                />
              </div>

              {/* Protocol selector */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1.5 tracking-wider uppercase">
                  COMMUNICATION LINK
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      SoundEngine.playClick(1000, 0.03, 0.05);
                      setConnMode("ws");
                    }}
                    className={`py-2 rounded-lg font-mono text-xs font-bold border transition-all ${
                      connMode === "ws"
                        ? "bg-porsche-yellow/15 border-porsche-yellow text-porsche-yellow shadow-[0_0_10px_rgba(242,211,41,0.15)]"
                        : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    WEBSOCKET
                  </button>
                  <button 
                    onClick={() => {
                      SoundEngine.playClick(1000, 0.03, 0.05);
                      setConnMode("http");
                    }}
                    className={`py-2 rounded-lg font-mono text-xs font-bold border transition-all ${
                      connMode === "http"
                        ? "bg-porsche-yellow/15 border-porsche-yellow text-porsche-yellow shadow-[0_0_10px_rgba(242,211,41,0.15)]"
                        : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    HTTP API
                  </button>
                </div>
              </div>

              {/* Sound Toggle */}
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 mb-1 tracking-wider uppercase">
                  AUDIO SYNTHESIZER
                </label>
                <button
                  onClick={() => {
                    const newMute = !soundMuted;
                    setSoundMuted(newMute);
                    SoundEngine.setMuted(newMute);
                    SoundEngine.playClick();
                  }}
                  className={`w-full py-2 px-3 rounded-lg border font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    !soundMuted 
                      ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-400" 
                      : "bg-zinc-900/30 border-zinc-800 text-zinc-500"
                  }`}
                >
                  {!soundMuted ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      SYNTH ENGINE ACTIVE (MUTE)
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-zinc-600" />
                      SYNTH ENGINE MUTED (UNMUTE)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right side: Connection Action & Status */}
            <div className="flex flex-col justify-between p-4 rounded-xl bg-zinc-950/80 border border-zinc-800">
              <div className="text-left">
                <span className="text-[10px] font-mono text-zinc-500 tracking-wider">TELEM LINK STATUS</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    connected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" : 
                    status.includes("Connect") || status.includes("Search") ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                  }`} />
                  <span className="font-mono text-xs font-bold text-zinc-300 uppercase tracking-widest">{status}</span>
                </div>
                <div className="mt-3 text-[10px] font-mono text-zinc-400 leading-relaxed">
                  {connected 
                    ? `Telemetry established to ${ipAddress} via ${connMode.toUpperCase()}. Link frequency active at 35Hz packet rate.`
                    : "No telemetry connection. Input IP and establish link to power the dashboard telemetrics."
                  }
                </div>
              </div>

              <div className="mt-4">
                {!connected ? (
                  <button
                    onClick={() => {
                      SoundEngine.playClick();
                      onConnect();
                    }}
                    className="w-full py-2.5 rounded-lg bg-porsche-yellow hover:bg-yellow-400 text-zinc-950 font-bold text-xs tracking-widest transition-all cursor-pointer font-mono shadow-[0_0_15px_rgba(242,211,41,0.2)]"
                  >
                    LINK TO CAR
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      SoundEngine.playClick();
                      onDisconnect();
                    }}
                    className="w-full py-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/50 text-rose-200 font-bold text-xs tracking-widest transition-all cursor-pointer font-mono"
                  >
                    DISCONNECT LINK
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Diagnostics Section */}
          <div className="text-left">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase">
                ECU LIVE CONSOLE LOGS
              </label>
              <button 
                onClick={() => {
                  SoundEngine.playClick();
                  onClearLogs();
                }}
                className="text-[9px] font-mono text-porsche-yellow/70 hover:text-porsche-yellow hover:underline transition-all cursor-pointer"
              >
                CLEAR CONSOLE
              </button>
            </div>
            <div className="h-28 overflow-y-auto rounded-lg bg-zinc-950/90 border border-zinc-900 p-3 font-mono text-[10px] text-zinc-400 leading-relaxed no-scrollbar flex flex-col gap-1">
              {logs.length === 0 ? (
                <div className="text-zinc-600 text-center py-6">TELEMETRY DIAGNOSTIC STREAM SILENT.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="truncate select-text select-all hover:text-zinc-200">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
