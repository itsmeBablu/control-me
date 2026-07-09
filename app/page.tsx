"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [device, setDevice] = useState<any>(null);
  const [status, setStatus] = useState("Not connected");
  const [angle, setAngle] = useState(90);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [springReturn, setSpringReturn] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<{ [key: string]: boolean }>({});
  const [unsupported, setUnsupported] = useState(false);

  const characteristicRef = useRef<any>(null);
  const deviceRef = useRef<any>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Throttled Write Queue Refs
  const writingRef = useRef(false);
  const nextAngleRef = useRef<number | null>(null);

  // Helper to log system events
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 39)]);
  }, []);

  // Check Web Bluetooth support
  useEffect(() => {
    setMounted(true);
    const isSupported = typeof window !== "undefined" && !!(navigator as any).bluetooth;
    setUnsupported(!isSupported);
    if (isSupported) {
      addLog("System initialized. Web Bluetooth is supported.");
    } else {
      addLog("WARNING: Web Bluetooth is NOT supported in this browser.");
    }
  }, [addLog]);

  // Audio Synthesizers (Web Audio API)
  const playSound = useCallback((type: "click" | "connect" | "disconnect" | "steer") => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "connect") {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.type = "sine";
        osc2.type = "sine";
        
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc1.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1); // Major third
        
        osc2.frequency.setValueAtTime(554.37, ctx.currentTime);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // Perfect fifth
        
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.3);
        osc2.stop(ctx.currentTime + 0.3);
      } else if (type === "disconnect") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (err) {
      console.warn("Audio Context block or error:", err);
    }
  }, [soundEnabled]);

  // Transmit angle to ESP32 with write throttling/queueing
  const sendAngle = useCallback(async (newAngle: number) => {
    setAngle(newAngle);
    if (!characteristicRef.current) return;

    if (writingRef.current) {
      nextAngleRef.current = newAngle;
      return;
    }

    writingRef.current = true;
    let angleToSend: number | null = newAngle;

    try {
      while (angleToSend !== null) {
        const data = new Uint8Array([angleToSend]);
        await characteristicRef.current.writeValue(data);
        
        // Grab the next angle queued, and reset queue pointer
        angleToSend = nextAngleRef.current;
        nextAngleRef.current = null;
      }
    } catch (err: any) {
      console.error("BLE Write error:", err);
      addLog(`Write Error: ${err.message}`);
      alert(`Write failed: ${err.message}\nPlease unpair/forget the device, restart ESP32, and try reconnecting.`);
    } finally {
      writingRef.current = false;
    }
  }, [addLog]);

  // Connect BLE Device
  async function connectBLE() {
    if (unsupported) {
      addLog("Cannot connect: Web Bluetooth is not supported.");
      return;
    }

    try {
      setStatus("Searching...");
      addLog("Requesting Bluetooth device ESP32-RC-Car...");
      
      const targetDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: "ESP32-RC-Car" }],
        optionalServices: [SERVICE_UUID],
      });

      deviceRef.current = targetDevice;
      setDevice(targetDevice);

      addLog(`Found device: ${targetDevice.name}. Connecting to GATT server...`);
      setStatus("Connecting...");
      
      targetDevice.addEventListener("gattserverdisconnected", onDisconnected);

      const server = await targetDevice.gatt.connect();
      addLog("GATT server connected. Retrieving service...");
      
      const service = await server.getPrimaryService(SERVICE_UUID);
      addLog("Service resolved. Fetching characteristic...");
      
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      addLog("Servo Characteristic linked! Connection established.");

      characteristicRef.current = characteristic;
      setConnected(true);
      setStatus(`Connected to ${targetDevice.name}`);
      playSound("connect");
    } catch (err: any) {
      console.error(err);
      setStatus("Error connecting");
      addLog(`Connection failed: ${err.message}`);
      playSound("disconnect");
    }
  }

  // Handle Disconnection
  const onDisconnected = useCallback(() => {
    setConnected(false);
    setStatus("Disconnected");
    addLog("GATT server disconnected.");
    characteristicRef.current = null;
    deviceRef.current = null;
    setDevice(null);
    playSound("disconnect");
  }, [addLog, playSound]);

  // Disconnect BLE
  async function disconnectBLE() {
    addLog("User requested disconnect.");
    if (deviceRef.current && deviceRef.current.gatt.connected) {
      deviceRef.current.gatt.disconnect();
    } else {
      onDisconnected();
    }
  }

  // Handle Keyboard Steering Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) {
        // Prevent viewport scrolling when focus is on page controls
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          e.preventDefault();
        }
        setPressedKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) {
        setPressedKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Smooth keyboard steering loop
  useEffect(() => {
    let active = true;
    
    const updateSteering = () => {
      if (!active) return;

      const leftPressed = pressedKeys["arrowleft"] || pressedKeys["a"];
      const rightPressed = pressedKeys["arrowright"] || pressedKeys["d"];

      if (leftPressed || rightPressed) {
        const step = rightPressed ? 3 : -3;
        setAngle((prev) => {
          const next = Math.max(0, Math.min(180, prev + step));
          if (next !== prev) {
            sendAngle(next);
          }
          return next;
        });
      } else if (springReturn && !isDragging) {
        // Smooth snap back to 90 degrees (center)
        setAngle((prev) => {
          if (prev === 90) return prev;
          const diff = 90 - prev;
          // Step sizes: large steps for big gaps, snapping at the end
          const snapStep = Math.sign(diff) * Math.min(6, Math.abs(diff));
          const next = prev + snapStep;
          if (next !== prev) {
            sendAngle(next);
          }
          return next;
        });
      }

      requestAnimationFrame(updateSteering);
    };

    const frameId = requestAnimationFrame(updateSteering);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [pressedKeys, springReturn, isDragging, sendAngle]);

  // Steering Wheel Pointer Calculations
  const updateAngleFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    const angleRad = Math.atan2(dy, dx);
    let angleDeg = angleRad * (180 / Math.PI);

    // Normalize so straight up (atan2 -90deg) is 0deg steering
    let rotation = angleDeg + 90;
    if (rotation > 180) rotation -= 360;
    if (rotation < -180) rotation += 360;

    // Limit rotation to standard [-90, 90] degrees (full left/right)
    const clampedRotation = Math.max(-90, Math.min(90, rotation));
    const targetServoAngle = Math.round(clampedRotation + 90);

    sendAngle(targetServoAngle);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateAngleFromPointer(e);
    playSound("click");
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateAngleFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (springReturn) {
      sendAngle(90);
    }
  };

  // Safe Hydration Guard
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-400 flex items-center justify-center font-mono tracking-wider">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-cyan-500 text-sm animate-pulse">BOOTING TELEMETRY HUD...</p>
        </div>
      </div>
    );
  }

  // Front wheels rotation mapping for the car SVG (clamped to realistic max -35 to +35 deg steering)
  const steerVisualAngle = (angle - 90) * (35 / 90);

  return (
    <div className="min-h-screen bg-radial from-[#1e1b4b]/80 via-[#030712] to-[#030712] text-slate-100 flex flex-col justify-between p-4 md:p-6 font-sans">
      
      {/* HEADER SECTION */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between mb-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              connected ? "bg-emerald-400" : status === "Connecting..." || status === "Searching..." ? "bg-cyan-400" : "bg-red-400"
            }`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              connected ? "bg-emerald-500" : status === "Connecting..." || status === "Searching..." ? "bg-cyan-500" : "bg-red-500"
            }`}></span>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-200 to-pink-400">
              ESP32 RC COCKPIT
            </h1>
            <p className="text-[10px] md:text-xs font-mono text-cyan-400/70 tracking-widest">SERVO TELEMETRY SYSTEM v1.2</p>
          </div>
        </div>

        {/* AUDIO TOGGLE BUTTON */}
        <button
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            playSound("click");
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all duration-300 ${
            soundEnabled 
              ? "bg-[#1e1b4b]/40 border-indigo-500/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.15)]" 
              : "bg-slate-900/20 border-slate-800 text-slate-500"
          }`}
          aria-label="Toggle sound effects"
        >
          {soundEnabled ? (
            <>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zm-2 16.77l-5-5H3v-6h4l5-5v16z"/>
              </svg>
              <span>SOUND ON</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
              <span>SOUND OFF</span>
            </>
          )}
        </button>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start content-start">
        
        {/* COMPATIBILITY NOTICE FOR NON-SUPPORTED DEVICES */}
        {unsupported && (
          <div className="lg:col-span-12 bg-red-950/20 border border-red-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-[0_0_15px_rgba(239,68,68,0.05)]">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
              <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-300">Web Bluetooth Unsupported in Current Browser</h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                To steer the ESP32-S3 via mobile Bluetooth, please open this app in a compatible browser. Use <span className="text-cyan-300 font-semibold">Chrome on Android</span>, or download <span className="text-cyan-300 font-semibold">Bluefy Browser / WebBLE</span> on iOS.
              </p>
            </div>
          </div>
        )}

        {/* LEFT COLUMN: VISUALIZATIONS & DRIVER */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[380px] md:min-h-[440px]">
            {/* Grid background effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-10 pointer-events-none"></div>
            
            {/* Ambient glows */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-48 h-48 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none"></div>

            {/* TELEMETRY READOUT OVERLAY */}
            <div className="absolute top-4 left-4 font-mono text-[10px] text-slate-500 flex flex-col gap-1 pointer-events-none select-none text-left">
              <div>STEER_RAD: <span className="text-cyan-400">{((angle - 90) * Math.PI / 180).toFixed(4)}</span></div>
              <div>STEER_DEG: <span className="text-cyan-400">{angle - 90}°</span></div>
              <div>SERVO_VAL: <span className="text-cyan-400">{angle}</span></div>
            </div>

            <div className="absolute top-4 right-4 font-mono text-[10px] text-slate-500 flex flex-col gap-1 pointer-events-none select-none items-end">
              <div>DEVICE: <span className={connected ? "text-emerald-400" : "text-red-400"}>{connected ? "CONNECTED" : "OFFLINE"}</span></div>
              <div>LINK_FREQ: <span className="text-cyan-400">BLE 2.4 GHz</span></div>
            </div>

            {/* VISUAL CAR PREVIEW */}
            <div className="relative w-[140px] h-[200px] mb-8 select-none pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 100 160" className="drop-shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                {/* Rear wheels */}
                <rect x="6" y="105" width="12" height="26" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                <rect x="82" y="105" width="12" height="26" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                
                {/* Rear axle */}
                <line x1="18" y1="118" x2="82" y2="118" stroke="#1e293b" strokeWidth="3" />

                {/* Front Left steerable wheel */}
                <g transform={`translate(12, 32) rotate(${steerVisualAngle}) translate(-6, -13)`}>
                  <rect x="0" y="0" width="12" height="26" rx="3" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.5" />
                  <line x1="3" y1="5" x2="9" y2="5" stroke="#06b6d4" strokeWidth="1.2" opacity="0.6" />
                  <line x1="3" y1="13" x2="9" y2="13" stroke="#06b6d4" strokeWidth="1.2" opacity="0.6" />
                  <line x1="3" y1="21" x2="9" y2="21" stroke="#06b6d4" strokeWidth="1.2" opacity="0.6" />
                </g>

                {/* Front Right steerable wheel */}
                <g transform={`translate(88, 32) rotate(${steerVisualAngle}) translate(-6, -13)`}>
                  <rect x="0" y="0" width="12" height="26" rx="3" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.5" />
                  <line x1="3" y1="5" x2="9" y2="5" stroke="#06b6d4" strokeWidth="1.2" opacity="0.6" />
                  <line x1="3" y1="13" x2="9" y2="13" stroke="#06b6d4" strokeWidth="1.2" opacity="0.6" />
                  <line x1="3" y1="21" x2="9" y2="21" stroke="#06b6d4" strokeWidth="1.2" opacity="0.6" />
                </g>

                {/* Front axle */}
                <line x1="18" y1="32" x2="82" y2="32" stroke="#1e293b" strokeWidth="3" />

                {/* Sports Car Chassis Silhouette */}
                <path 
                  d="M 30,15 C 30,15 35,5 50,5 C 65,5 70,15 70,15 L 76,32 C 81,45 85,60 85,80 L 80,122 C 80,132 75,140 68,142 L 32,142 C 25,140 20,132 20,122 L 15,80 C 15,60 19,45 24,32 Z" 
                  fill="#030712" 
                  stroke={connected ? "#6366f1" : "#475569"} 
                  strokeWidth="2" 
                  style={{ filter: connected ? "drop-shadow(0px 0px 8px rgba(99, 102, 241, 0.4))" : "none" }}
                  className="transition-colors duration-500"
                />

                {/* Spoiler */}
                <path d="M 12,130 L 88,130 L 85,138 L 15,138 Z" fill="#030712" stroke="#ec4899" strokeWidth="1.5" opacity="0.9" />
                
                {/* Windshield & cockpit canopy */}
                <path d="M 35,46 C 35,46 50,34 65,46 L 68,75 C 68,80 62,85 50,85 C 38,85 32,80 32,75 Z" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />

                {/* Glowing neon headlights */}
                <polygon points="26,11 32,9 34,13 26,13" fill="#22d3ee" className="animate-pulse" />
                <polygon points="74,11 68,9 66,13 74,13" fill="#22d3ee" className="animate-pulse" />

                {/* Brake lights: Glow red when centered (at 90 degrees) */}
                <rect x="23" y="141" width="9" height="2" fill={angle === 90 ? "#ef4444" : "#7f1d1d"} className="transition-all duration-300" style={{ filter: angle === 90 ? "drop-shadow(0px 0px 4px rgba(239, 68, 68, 0.8))" : "none" }} />
                <rect x="68" y="141" width="9" height="2" fill={angle === 90 ? "#ef4444" : "#7f1d1d"} className="transition-all duration-300" style={{ filter: angle === 90 ? "drop-shadow(0px 0px 4px rgba(239, 68, 68, 0.8))" : "none" }} />

                {/* Active Blinkers */}
                <circle cx="28" cy="18" r="3" fill={angle < 75 ? "#fbbf24" : "#78350f"} className={angle < 75 ? "animate-pulse" : ""} />
                <circle cx="72" cy="18" r="3" fill={angle > 105 ? "#fbbf24" : "#78350f"} className={angle > 105 ? "animate-pulse" : ""} />
              </svg>
            </div>

            {/* COCKPIT DIAL ARC IN MILLISECONDS/DEGREES */}
            <div className="relative flex flex-col items-center">
              {/* STEERING WHEEL */}
              <div 
                ref={wheelRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-[180px] h-[180px] md:w-[200px] md:h-[200px] cursor-grab active:cursor-grabbing touch-none select-none relative flex items-center justify-center rounded-full bg-slate-950/70 p-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.5)] border border-slate-800/80 transition-transform duration-75"
                style={{ 
                  transform: `rotate(${angle - 90}deg)`,
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 200 200" className="w-full h-full select-none pointer-events-none">
                  {/* Outer Rim Shadow */}
                  <circle cx="100" cy="100" r="88" fill="none" stroke="#020617" strokeWidth="16" />
                  
                  {/* Outer Rim */}
                  <circle cx="100" cy="100" r="88" fill="none" stroke="#1e293b" strokeWidth="12" />
                  
                  {/* Rim highlight rings */}
                  <circle cx="100" cy="100" r="92" fill="none" stroke="#334155" strokeWidth="1" />
                  <circle cx="100" cy="100" r="84" fill="none" stroke="#475569" strokeWidth="1" />
                  
                  {/* Glowing inner trim (Cyan when connected) */}
                  <circle cx="100" cy="100" r="80" fill="none" stroke={connected ? "#06b6d4" : "#475569"} strokeWidth="1" opacity={connected ? 0.4 : 0.15} />

                  {/* Spokes */}
                  {/* Left Spoke */}
                  <path d="M 20 100 L 76 100 Q 76 112 85 118" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 20 100 L 76 100" fill="none" stroke="#334155" strokeWidth="2" />
                  
                  {/* Right Spoke */}
                  <path d="M 180 100 L 124 100 Q 124 112 115 118" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 180 100 L 124 100" fill="none" stroke="#334155" strokeWidth="2" />

                  {/* Bottom Spoke */}
                  <path d="M 100 180 L 100 126 Q 92 126 86 118" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
                  <line x1="100" y1="180" x2="100" y2="126" stroke="#334155" strokeWidth="2" />

                  {/* Center Cap Hub */}
                  <circle cx="100" cy="100" r="28" fill="#090d16" stroke={connected ? "#6366f1" : "#334155"} strokeWidth="3" />
                  
                  {/* Accent in Center */}
                  <circle cx="100" cy="100" r="20" fill="#030712" />
                  <text x="100" y="104" textAnchor="middle" fill={connected ? "#06b6d4" : "#64748b"} fontSize="12" fontWeight="900" letterSpacing="1" fontFamily="monospace">
                    RC
                  </text>

                  {/* TOP ALIGNMENT STRIPE (Visual guide) */}
                  <rect x="97" y="6" width="6" height="12" fill="#ef4444" rx="1.5" />
                </svg>
              </div>

              {/* Angle scale indicators underneath steering wheel */}
              <div className="absolute -bottom-6 w-full flex items-center justify-between font-mono text-[10px] text-slate-500 px-4 min-w-[200px] select-none pointer-events-none">
                <span>0° L</span>
                <span className="text-indigo-400 font-bold">90° STEER</span>
                <span>180° R</span>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: CONNECTION & TELEMETRY CONTROL PANELS */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* CONNECTION CONTROLLERS */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-4 font-mono">CONNECTION TERMINAL</h2>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3">
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 font-mono">STATUS</div>
                  <div className="text-sm font-bold tracking-wide text-slate-200 mt-0.5">{status}</div>
                </div>
                <div className="flex items-center gap-2">
                  {connected && (
                    <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
                      CONNECTED
                    </span>
                  )}
                  {!connected && (
                    <span className="text-[10px] font-mono bg-slate-800/60 text-slate-400 border border-slate-700/30 px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
                      OFFLINE
                    </span>
                  )}
                </div>
              </div>

              {/* ACTION CONNECT BUTTONS */}
              {!connected ? (
                <button
                  onClick={connectBLE}
                  disabled={unsupported}
                  className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 font-bold text-sm tracking-widest transition-all duration-300 ${
                    unsupported 
                      ? "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed" 
                      : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  }`}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M7 17h10v-2H7v2zm5-13c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
                  </svg>
                  CONNECT ESP32
                </button>
              ) : (
                <button
                  onClick={disconnectBLE}
                  className="w-full py-3.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-950/60 border border-red-500/50 hover:border-red-500 text-red-200 font-bold text-sm tracking-widest transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                >
                  DISCONNECT
                </button>
              )}
            </div>
          </div>

          {/* TELEMETRY CONTROLS CARD */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-bold tracking-widest text-slate-400 font-mono text-left">SERVO STEER PROFILE</h2>
              <div className="text-lg font-black text-cyan-400 font-mono bg-cyan-950/30 border border-cyan-500/20 px-3 py-0.5 rounded-lg">
                {angle}°
              </div>
            </div>

            {/* PRESETS BUTTONS */}
            <div className="mb-6 text-left">
              <div className="text-[10px] text-slate-500 font-mono mb-2">STEER PRESETS</div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: "L100", val: 0 },
                  { label: "L50", val: 45 },
                  { label: "CTR", val: 90 },
                  { label: "R50", val: 135 },
                  { label: "R100", val: 180 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      sendAngle(item.val);
                      playSound("click");
                    }}
                    className={`py-2 rounded-lg font-mono text-[10px] font-bold border transition-all duration-200 ${
                      angle === item.val
                        ? "bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SLIDER CONTROL */}
            <div className="mb-6 text-left">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-2">
                <span>FINE SLIDER</span>
                <span>CENTER: 90°</span>
              </div>
              <div className="relative flex items-center group">
                <input
                  type="range"
                  min="0"
                  max="180"
                  value={angle}
                  onChange={(e) => {
                    sendAngle(Number(e.target.value));
                  }}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  style={{
                    background: `linear-gradient(to right, #0891b2 0%, #0891b2 ${(angle/180)*100}%, #020617 ${(angle/180)*100}%, #020617 100%)`
                  }}
                />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-slate-600 mt-1">
                <span>FULL LEFT (0°)</span>
                <span>FULL RIGHT (180°)</span>
              </div>
            </div>

            {/* FINE TUNING BUTTONS */}
            <div className="mb-6 flex gap-4 text-left">
              <div className="flex-1">
                <div className="text-[10px] text-slate-500 font-mono mb-2">TRIM LEFT</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      sendAngle(Math.max(0, angle - 5));
                      playSound("click");
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 font-bold active:bg-slate-900 transition-colors"
                  >
                    -5°
                  </button>
                  <button
                    onClick={() => {
                      sendAngle(Math.max(0, angle - 1));
                      playSound("click");
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 font-bold active:bg-slate-900 transition-colors"
                  >
                    -1°
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <div className="text-[10px] text-slate-500 font-mono mb-2">TRIM RIGHT</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      sendAngle(Math.min(180, angle + 1));
                      playSound("click");
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 font-bold active:bg-slate-900 transition-colors"
                  >
                    +1°
                  </button>
                  <button
                    onClick={() => {
                      sendAngle(Math.min(180, angle + 5));
                      playSound("click");
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 font-bold active:bg-slate-900 transition-colors"
                  >
                    +5°
                  </button>
                </div>
              </div>
            </div>

            {/* TOGGLES / OPTIONS */}
            <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3 text-left">
              {/* SPRING RETURN TOGGLE */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-300">Spring Return Mode</div>
                  <div className="text-[10px] text-slate-500 font-mono">Snaps steering to center on release</div>
                </div>
                <button
                  onClick={() => {
                    setSpringReturn(!springReturn);
                    playSound("click");
                  }}
                  className={`w-11 h-6 rounded-full p-1 transition-all duration-300 flex items-center ${
                    springReturn ? "bg-cyan-500 justify-end" : "bg-slate-800 justify-start"
                  }`}
                  aria-label="Toggle spring return mode"
                >
                  <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md"></span>
                </button>
              </div>

              {/* KEYBOARD CONTROLS HELPER */}
              <div className="mt-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex gap-3 items-center">
                <div className="bg-slate-900 border border-slate-800 px-2 py-1 rounded font-mono text-[10px] text-cyan-400 font-bold shrink-0 shadow-inner">
                  A / D
                </div>
                <div className="text-[10px] text-slate-400 font-mono leading-normal">
                  Hold <span className="text-slate-200">A</span> / <span className="text-slate-200">D</span> or <span className="text-slate-200">Left</span> / <span className="text-slate-200">Right</span> arrows to steer from keyboard.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER DIAGNOSTIC LOGS PANEL */}
      <footer className="max-w-6xl w-full mx-auto mt-6 text-left">
        <div className="bg-slate-950/90 border border-slate-900 rounded-2xl p-4 shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
            <h2 className="text-[10px] font-bold tracking-widest text-slate-500 font-mono uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              DIAGNOSTIC TELEMETRY LOGS
            </h2>
            <button 
              onClick={() => {
                setLogs([]);
                playSound("click");
              }}
              className="text-[9px] font-mono text-cyan-500 hover:text-cyan-400 transition-colors uppercase cursor-pointer"
            >
              Clear Logs
            </button>
          </div>

          {/* Log Messages Container */}
          <div className="h-28 overflow-y-auto font-mono text-[10px] leading-relaxed text-cyan-500/80 flex flex-col gap-1 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-600 text-center py-6">LOGS IS EMPTY. INITIATE TELEMETRY STREAM.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="truncate select-text">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
