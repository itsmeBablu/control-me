"use client";

import { useEffect, useState } from "react";

interface InstrumentClusterProps {
  speed: number; // -100 to 100
  connected: boolean;
  isBraking: boolean;
  lightsState: {
    headlights: boolean;
    hazards: boolean;
    neon: boolean;
  };
  pingTime: number; // in ms
}

export default function InstrumentCluster({
  speed,
  connected,
  isBraking,
  lightsState,
  pingTime,
}: InstrumentClusterProps) {
  const [rpm, setRpm] = useState<number>(0);
  const [gear, setGear] = useState<number>(1);
  const [batteryLevel, setBatteryLevel] = useState<number>(84); // virtual battery
  const [voltage, setVoltage] = useState<number>(3.92); // virtual voltage 3.7V lipo
  
  // Throttle value
  const throttle = Math.abs(speed);

  // Smooth RPM and gear shifting calculation
  useEffect(() => {
    let animId: number;
    let currentRpm = 0;
    
    const updatePhysics = () => {
      // Basic target RPM calculations
      // Idle is ~800, redline is ~7200
      let targetRpm = 800;

      if (connected && throttle > 0) {
        // Gear shifts logic:
        // Gear 1: 0 - 25% speed -> RPM goes 800 - 6500
        // Gear 2: 25% - 55% speed -> RPM goes 4000 - 6800
        // Gear 3: 55% - 100% speed -> RPM goes 4200 - 7200
        if (throttle <= 25) {
          setGear(1);
          const ratio = throttle / 25;
          targetRpm = 800 + ratio * 5700;
        } else if (throttle <= 55) {
          setGear(2);
          const ratio = (throttle - 25) / 30;
          targetRpm = 3800 + ratio * 3000;
        } else {
          setGear(3);
          const ratio = (throttle - 55) / 45;
          targetRpm = 4100 + ratio * 3100;
        }
      } else {
        setGear(1);
        targetRpm = connected ? 800 : 0; // engine dead if offline
      }

      // Smooth lag on RPM needle
      const smoothK = 0.12;
      currentRpm += (targetRpm - currentRpm) * smoothK;
      setRpm(currentRpm);

      animId = requestAnimationFrame(updatePhysics);
    };

    updatePhysics();
    return () => cancelAnimationFrame(animId);
  }, [throttle, connected]);

  // Slow battery discharge emulation
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      setBatteryLevel((prev) => {
        const next = Math.max(12, prev - 0.05); // slowly ticks down
        setVoltage(Number((3.4 + (next / 100) * 0.8).toFixed(2))); // scale 3.4V to 4.2V
        return next;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [connected]);

  // Angle maps for speedometer & tachometer needles
  // RPM: 0 = -135deg, 8000 = +135deg. Center (4000) = 0deg.
  const rpmNeedleAngle = -135 + (rpm / 8000) * 270;
  
  // Speedometer: 0 = -135deg, 100 = +135deg
  const speedNeedleAngle = -135 + (throttle / 100) * 270;

  // Battery: 3.4V (low) = -50deg, 4.2V (full) = +50deg
  const voltNeedleAngle = -50 + ((voltage - 3.4) / 0.8) * 100;

  return (
    <div className="w-full flex items-center justify-center p-1 relative overflow-hidden">
      {/* Grid structure holding the Porsche Instrument Cluster */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 max-w-4xl w-full select-none">
        
        {/* DIAL 1: TEMPERATURES & OIL PRESS (Left-most) */}
        <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/35 border border-zinc-800/40 relative aspect-square max-h-[60px] sm:max-h-[85px] md:max-h-[110px] lg:max-h-[135px]">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Outline rings */}
            <circle cx="50" cy="50" r="42" fill="none" stroke="#222" strokeWidth="2" />
            
            {/* Water temperature arch (Left side) */}
            <path d="M 24 76 A 35 35 0 0 1 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" />
            <path d="M 24 76 A 35 35 0 0 1 24 50" fill="none" stroke="#b48e63" strokeWidth="2.5" /> {/* gold mark */}
            
            {/* Oil pressure arch (Right side) */}
            <path d="M 76 24 A 35 35 0 0 1 76 76" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" />
            <path d="M 76 50 A 35 35 0 0 1 76 76" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
            
            {/* Mini Dial labels */}
            <text x="36" y="52" fill="#555" fontSize="6" fontFamily="monospace" textAnchor="middle">OIL</text>
            <text x="36" y="60" fill="#777" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              {connected ? "4.5" : "0.0"}
            </text>
            
            <text x="64" y="52" fill="#555" fontSize="6" fontFamily="monospace" textAnchor="middle">TEMP</text>
            <text x="64" y="60" fill="#777" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              {connected ? "94°C" : "15°C"}
            </text>
          </svg>
          <span className="hidden sm:block absolute bottom-0.5 font-mono text-[5.5px] md:text-[6.5px] text-zinc-500 uppercase tracking-widest">AUX GAUGES</span>
        </div>

        {/* DIAL 2: ANALOG SPEEDOMETER (Mid-Left) */}
        <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/35 border border-zinc-800/40 relative aspect-square max-h-[60px] sm:max-h-[85px] md:max-h-[110px] lg:max-h-[135px]">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            {/* Dial scale */}
            <circle cx="50" cy="50" r="42" fill="none" stroke="#222" strokeWidth="2" />
            <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="1 3" />
            
            {/* Digital Speed read */}
            <text x="50" y="46" fill="#f2d329" fontSize="13" fontWeight="900" fontFamily="monospace" textAnchor="middle" className="text-glow-yellow">
              {connected ? Math.round(throttle) : 0}
            </text>
            <text x="50" y="55" fill="#555" fontSize="6" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">KM/H</text>

            <text x="26" y="70" fill="#444" fontSize="7" fontFamily="monospace" textAnchor="middle">0</text>
            <text x="20" y="50" fill="#444" fontSize="7" fontFamily="monospace" textAnchor="middle">20</text>
            <text x="32" y="28" fill="#444" fontSize="7" fontFamily="monospace" textAnchor="middle">40</text>
            <text x="50" y="20" fill="#444" fontSize="7" fontFamily="monospace" textAnchor="middle">60</text>
            <text x="68" y="28" fill="#444" fontSize="7" fontFamily="monospace" textAnchor="middle">80</text>
            <text x="80" y="50" fill="#444" fontSize="7" fontFamily="monospace" textAnchor="middle">100</text>

            {/* Needle */}
            <g transform={`rotate(${speedNeedleAngle} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="12" stroke="#b48e63" strokeWidth="1.5" strokeLinecap="round" /> {/* gold pointer */}
              <circle cx="50" cy="50" r="3" fill="#b48e63" />
            </g>
          </svg>
          <span className="hidden sm:block absolute bottom-0.5 font-mono text-[5.5px] md:text-[6.5px] text-zinc-500 uppercase tracking-widest">VELOCITY</span>
        </div>

        {/* DIAL 3: LARGE TACHOMETER (Center - GT2 RS Yellow) */}
        <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/50 border border-porsche-yellow/30 relative aspect-square max-h-[60px] sm:max-h-[85px] md:max-h-[110px] lg:max-h-[135px] shadow-[0_0_15px_rgba(242,211,41,0.05)]">
          <svg className="w-full h-full" viewBox="0 0 120 120">
            {/* Center cap rings */}
            <circle cx="60" cy="60" r="52" fill="none" stroke="#2a2a2a" strokeWidth="2.5" />
            
            {/* Curved scale ticks */}
            <path d="M 26 94 A 48 48 0 1 1 94 94" fill="none" stroke="#444" strokeWidth="3" strokeLinecap="round" />
            {/* Redline band starting at 7000 (around 7/8th of progress) */}
            <path d="M 88.5 40 A 48 48 0 0 1 94 94" fill="none" stroke="#ef4444" strokeWidth="4" />

            {/* Dials ticks labels */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((val) => {
              const theta = -135 + val * 30; // each step is 30 deg
              const rad = (theta * Math.PI) / 180;
              const lx = 60 + Math.cos(rad) * 36;
              const ly = 60 + Math.sin(rad) * 36;
              const color = val >= 7 ? "#ef4444" : "#f2d329";
              return (
                <text 
                  key={val} 
                  x={lx} 
                  y={ly + 3} 
                  fill={color} 
                  fontSize="8.5" 
                  fontWeight="bold" 
                  fontFamily="monospace" 
                  textAnchor="middle"
                >
                  {val}
                </text>
              );
            })}

            {/* RPM readout */}
            <text x="60" y="80" fill="#444" fontSize="6.5" fontFamily="monospace" textAnchor="middle">RPM x1000</text>
            <text x="60" y="88" fill="#f2d329" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle" className="text-glow-yellow">
              {connected ? Math.round(rpm) : 0}
            </text>

            {/* Center Gear Display Box */}
            <rect x="50" y="44" width="20" height="20" rx="3" fill="#090a0d" stroke="#f2d329" strokeWidth="1" />
            <text x="60" y="59" fill="#fff" fontSize="14" fontWeight="black" fontFamily="monospace" textAnchor="middle">
              {connected ? (speed < 0 ? "R" : gear) : "N"}
            </text>

            {/* Yellow Pointer Needle */}
            <g transform={`rotate(${rpmNeedleAngle} 60 60)`}>
              <line x1="60" y1="60" x2="60" y2="15" stroke="#f2d329" strokeWidth="2" strokeLinecap="round" className="gauge-ring" />
              <circle cx="60" cy="60" r="5" fill="#f2d329" />
              <circle cx="60" cy="60" r="2.5" fill="#111" />
            </g>
          </svg>
          <span className="hidden sm:block absolute bottom-0.5 font-mono text-[5.5px] md:text-[6.5px] text-porsche-yellow uppercase tracking-widest font-black text-glow-yellow">TACHOMETER</span>
        </div>

        {/* DIAL 4: BATTERY VOLTAGE & ENERGY (Mid-Right) */}
        <div className="flex flex-col items-center justify-center p-1 rounded-xl bg-zinc-900/35 border border-zinc-800/40 relative aspect-square max-h-[60px] sm:max-h-[85px] md:max-h-[110px] lg:max-h-[135px]">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#222" strokeWidth="2" />
            {/* 100deg arc. 3.4V to 4.2V */}
            <path d="M 23 68 A 35 35 0 0 1 77 68" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 23 68 A 35 35 0 0 1 35 44" fill="none" stroke="#ef4444" strokeWidth="3" /> {/* Red warning low */}

            <text x="50" y="32" fill="#555" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">LIPO BATT</text>
            <text x="50" y="44" fill="#b48e63" fontSize="10" fontWeight="900" fontFamily="monospace" textAnchor="middle" className="text-glow-gold">
              {connected ? `${batteryLevel.toFixed(0)}%` : "0%"}
            </text>
            <text x="50" y="53" fill="#777" fontSize="7.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              {connected ? `${voltage.toFixed(2)}V` : "0.0V"}
            </text>

            <text x="21" y="60" fill="#444" fontSize="6.5" fontFamily="monospace" textAnchor="middle">3.4</text>
            <text x="79" y="60" fill="#444" fontSize="6.5" fontFamily="monospace" textAnchor="middle">4.2</text>

            {/* Needle */}
            <g transform={`rotate(${voltNeedleAngle} 50 50)`}>
              <line x1="50" y1="50" x2="50" y2="18" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="50" cy="50" r="2.5" fill="#fff" />
            </g>
          </svg>
          <span className="hidden sm:block absolute bottom-0.5 font-mono text-[5.5px] md:text-[6.5px] text-zinc-500 uppercase tracking-widest">3.7V BATTERY</span>
        </div>

        {/* DIAL 5: TELEMETRY ECU MONITOR (Right-most) */}
        <div className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl bg-zinc-900/35 border border-zinc-800/40 relative aspect-square max-h-[60px] sm:max-h-[85px] md:max-h-[110px] lg:max-h-[135px] text-left font-mono text-[5.5px] sm:text-[7px] text-zinc-400 gap-0.5 sm:gap-1.5 overflow-hidden">
          <div className="w-full">
            <span className="text-[4.5px] sm:text-[6px] text-zinc-600 block uppercase leading-none">PING</span>
            <span className={`font-bold ${connected ? (pingTime < 45 ? "text-emerald-400" : "text-amber-400") : "text-zinc-500"}`}>
              {connected ? `${pingTime} MS` : "OFFLINE"}
            </span>
          </div>

          <div className="w-full">
            <span className="text-[4.5px] sm:text-[6px] text-zinc-600 block uppercase leading-none">WIFI</span>
            <span className="font-bold text-zinc-300">
              {connected ? "CH 6" : "OFFLINE"}
            </span>
          </div>

          <div className="w-full">
            <span className="text-[4.5px] sm:text-[6px] text-zinc-600 block uppercase leading-none">DUPLEX</span>
            <span className="font-bold text-porsche-gold tracking-tighter leading-none">
              {connected ? "WS_TX" : "STANDBY"}
            </span>
          </div>

          <div className="w-full flex items-center justify-between border-t border-zinc-800 pt-0.5 mt-0.5 leading-none">
            <span className="text-[5px] sm:text-[6.5px] text-zinc-500 uppercase">SYS</span>
            <div className="flex gap-0.5">
              <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${lightsState.headlights ? "bg-cyan-400" : "bg-zinc-800"}`} />
              <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${lightsState.hazards ? "bg-amber-400 animate-pulse" : "bg-zinc-800"}`} />
              <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isBraking ? "bg-rose-500" : "bg-zinc-800"}`} />
            </div>
          </div>
          <span className="hidden sm:block absolute bottom-0.5 font-mono text-[5.5px] md:text-[6.5px] text-zinc-500 uppercase tracking-widest">TELEMETRICS</span>
        </div>

      </div>
    </div>
  );
}
