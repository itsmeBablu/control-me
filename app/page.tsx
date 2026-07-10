"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import SoundEngine from "@/components/SoundEngine";
import ConnectionSettings from "@/components/ConnectionSettings";
import InstrumentCluster from "@/components/InstrumentCluster";
import SteeringWheel from "@/components/SteeringWheel";
import Pedals from "@/components/Pedals";
import LightControls from "@/components/LightControls";

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  
  // WiFi configurations
  const [ipAddress, setIpAddress] = useState("192.168.4.1");
  const [connMode, setConnMode] = useState<"ws" | "http">("ws");
  
  // Controls state
  const [steerAngle, setSteerAngle] = useState(90); // 0 to 180 (90 is center)
  const [speed, setSpeed] = useState(0);           // -100 to 100
  const [isBraking, setIsBraking] = useState(false);
  
  // Lighting state
  const [lights, setLights] = useState({
    headlights: false,
    hazards: false,
    neon: false,
  });

  // UI overlays
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [pingTime, setPingTime] = useState<number>(0);

  // Network Refs
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const transmissionIntervalRef = useRef<any>(null);

  // High-frequency control refs to prevent React state closure lag
  const stateRef = useRef({
    connected: false,
    steerAngle: 90,
    speed: 0,
    isBraking: false,
    lights: { headlights: false, hazards: false, neon: false },
    ipAddress: "192.168.4.1",
    connMode: "ws" as "ws" | "http"
  });

  // Update refs when state changes
  useEffect(() => {
    stateRef.current = {
      connected,
      steerAngle,
      speed,
      isBraking,
      lights,
      ipAddress,
      connMode
    };
  }, [connected, steerAngle, speed, isBraking, lights, ipAddress, connMode]);

  // Keep track of last sent packet to avoid spamming identical data
  const lastSentRef = useRef<string>("");
  const heartbeatCountRef = useRef<number>(0);

  // Diagnostic Log Appender
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 39)]);
  }, []);

  // System Mount Guard
  useEffect(() => {
    setMounted(true);
    addLog("Porsche Cockpit System initialized. Ready to connect over WiFi.");
    SoundEngine.setMuted(false); // default active
  }, [addLog]);

  // WebSocket / HTTP Connection Triggers
  const connectWiFi = useCallback(() => {
    const currentIP = stateRef.current.ipAddress;
    const currentMode = stateRef.current.connMode;

    disconnectWiFi(); // Clear existing links
    
    setStatus("Connecting...");
    addLog(`Initiating telemetry link to: ${currentIP} via ${currentMode.toUpperCase()}`);

    if (currentMode === "ws") {
      try {
        const wsUrl = `ws://${currentIP}/ws`;
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setConnected(true);
          setStatus("Connected");
          addLog("ECU WebSocket connection established.");
          
          // Play engine starter sequence
          SoundEngine.playStartup();
          
          // Start ping cycle
          startPingCycle();
          // Start high frequency transmission loop
          startTransmissionLoop();
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "pong") {
              const latency = Date.now() - data.t;
              setPingTime(latency);
            } else if (data.battery) {
              // Read incoming battery parameters from car if sent
              addLog(`Telemetry recv: Battery ${data.battery}V`);
            }
          } catch {
            // Echo raw text
            if (event.data.startsWith("pong:")) {
              const parts = event.data.split(":");
              const sentTime = parseInt(parts[1], 10);
              setPingTime(Date.now() - sentTime);
            } else {
              addLog(`Recv raw: ${event.data}`);
            }
          }
        };

        socket.onerror = (err) => {
          console.error("WebSocket Link Error", err);
          addLog("WebSocket encountered link protocol error.");
        };

        socket.onclose = () => {
          setConnected(false);
          setStatus("Disconnected");
          addLog("WebSocket session closed.");
          stopLoops();
          SoundEngine.playShutdown();
        };

      } catch (e: any) {
        setStatus("Connection Failed");
        addLog(`WebSocket creation failed: ${e.message}`);
        setConnected(false);
      }
    } else {
      // HTTP API Fallback Mode
      // Test endpoint ping
      setStatus("Pinging...");
      const pingUrl = `http://${currentIP}/ping`;
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2500);

      fetch(pingUrl, { signal: controller.signal, mode: 'no-cors' })
        .then(() => {
          clearTimeout(id);
          setConnected(true);
          setStatus("Connected");
          addLog("HTTP ECU ping successful. Link established.");
          SoundEngine.playStartup();
          startPingCycle();
          startTransmissionLoop();
        })
        .catch((err) => {
          clearTimeout(id);
          setStatus("Disconnected (Offline)");
          addLog(`HTTP ping to ${currentIP} failed.`);
          setConnected(false);
        });
    }
  }, [addLog]);

  const disconnectWiFi = useCallback(() => {
    addLog("User requested telemetry shutdown.");
    stopLoops();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
    setStatus("Disconnected");
    setPingTime(0);
    SoundEngine.playShutdown();
  }, [addLog]);

  // Ping intervals
  const startPingCycle = () => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    
    pingIntervalRef.current = setInterval(() => {
      const currentIP = stateRef.current.ipAddress;
      const currentMode = stateRef.current.connMode;
      const isConn = stateRef.current.connected;

      if (!isConn) return;

      if (currentMode === "ws" && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } else if (currentMode === "http") {
        const start = Date.now();
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1200);

        fetch(`http://${currentIP}/ping?t=${start}`, { signal: controller.signal, mode: 'no-cors' })
          .then(() => {
            clearTimeout(id);
            setPingTime(Date.now() - start);
          })
          .catch(() => {
            clearTimeout(id);
            setPingTime(999); // bad packet
          });
      }
    }, 1500); // ping every 1.5s
  };

  // Consolidation Transmission loop (Runs every ~35ms)
  const startTransmissionLoop = () => {
    if (transmissionIntervalRef.current) clearInterval(transmissionIntervalRef.current);

    transmissionIntervalRef.current = setInterval(() => {
      const activeState = stateRef.current;
      if (!activeState.connected) return;

      // Map combined parameters
      const telemetryPacket = {
        steer: activeState.steerAngle,
        speed: activeState.speed,
        brake: activeState.isBraking,
        headlights: activeState.lights.headlights,
        hazards: activeState.lights.hazards,
        neon: activeState.lights.neon
      };

      const packetString = JSON.stringify(telemetryPacket);
      heartbeatCountRef.current++;

      // Send only on changes, or as a watchdog heartbeat every 15 packets (~500ms)
      if (packetString !== lastSentRef.current || heartbeatCountRef.current >= 15) {
        lastSentRef.current = packetString;
        heartbeatCountRef.current = 0;

        if (activeState.connMode === "ws" && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(packetString);
        } else if (activeState.connMode === "http") {
          // Send HTTP command in background
          // E.g., http://<ip>/drive?steer=90&speed=100&brake=false&headlights=true...
          const params = new URLSearchParams({
            steer: String(telemetryPacket.steer),
            speed: String(telemetryPacket.speed),
            brake: String(telemetryPacket.brake),
            headlights: String(telemetryPacket.headlights),
            hazards: String(telemetryPacket.hazards),
            neon: String(telemetryPacket.neon)
          });
          
          fetch(`http://${activeState.ipAddress}/drive?${params.toString()}`, { mode: 'no-cors' })
            .catch((e) => console.warn("HTTP drive packet failed to transmit:", e));
        }
      }
    }, 35);
  };

  const stopLoops = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (transmissionIntervalRef.current) {
      clearInterval(transmissionIntervalRef.current);
      transmissionIntervalRef.current = null;
    }
  };

  // Safe unmount
  useEffect(() => {
    return () => {
      stopLoops();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Update SoundEngine throttle values
  useEffect(() => {
    if (connected) {
      SoundEngine.setThrottle(Math.abs(speed));
      SoundEngine.setBraking(isBraking);
    }
  }, [speed, isBraking, connected]);

  const handleDriveChange = useCallback((newSpeed: number, newBraking: boolean) => {
    setSpeed(newSpeed);
    setIsBraking(newBraking);
  }, []);

  const handleSteerChange = useCallback((newAngle: number) => {
    setSteerAngle(newAngle);
  }, []);

  const handleHornChange = useCallback((active: boolean) => {
    SoundEngine.setHorn(active);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#070708] text-porsche-yellow flex items-center justify-center font-mono tracking-wider">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-porsche-yellow border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm animate-pulse uppercase">Booting Porsche ECU...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between p-1 sm:p-2 md:p-3 relative overflow-hidden select-none touch-none ${
      lights.neon ? "shadow-[inset_0_0_50px_rgba(242,211,41,0.2)] border-2 border-porsche-yellow/30" : ""
    }`}>
      {/* 1. PORTRAIT ENFORCED ROTATION WARNING OVERLAY */}
      <div className="portrait-overlay fixed inset-0 z-[100] hidden flex-col items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-porsche-yellow/40 flex items-center justify-center mb-4 animate-pulse glow-yellow">
          <svg className="w-8 h-8 fill-none stroke-porsche-yellow" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
          </svg>
        </div>
        <h2 className="text-porsche-yellow font-black font-mono text-sm tracking-widest text-glow-yellow uppercase">
          Rotate Device to Landscape
        </h2>
        <p className="text-zinc-500 font-mono text-[10px] max-w-xs mt-1.5 leading-relaxed">
          The Porsche GT2 RS cockpit requires landscape orientation for tactile steering and pedals.
        </p>
      </div>

      {/* 2. COCKPIT HEADERHUD */}
      <header className="w-full flex items-center justify-between border-b border-zinc-900 pb-1 sm:pb-2 z-10 select-none">
        {/* Left Side: Logo + Car details */}
        <div className="flex items-center gap-2 sm:gap-3 text-left">
          {/* Porsche SVG logo with connection status badge */}
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/yellow-porsche.svg"
              alt="Porsche 911 GT2 RS"
              className="h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 object-contain drop-shadow-[0_0_6px_rgba(242,211,41,0.55)] select-none"
              draggable={false}
            />
            {/* Connection status dot — overlaid badge */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                connected ? "bg-emerald-400" : status === "Connecting..." || status === "Pinging..." ? "bg-amber-400" : "bg-rose-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                connected ? "bg-emerald-500" : status === "Connecting..." || status === "Pinging..." ? "bg-amber-500" : "bg-rose-500"
              }`}></span>
            </span>
          </div>

          {/* Car name + telemetry status */}
          <div className="leading-none">
            <h1 className="text-[10px] sm:text-xs md:text-sm font-black tracking-widest text-porsche-yellow text-glow-yellow">
              PORSCHE 911 GT2 RS
            </h1>
            <span className="text-[6.5px] sm:text-[7.5px] font-mono text-zinc-500 tracking-wider">
              TELEMETRICS // {connected ? `LINKED: ${ipAddress}` : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Right Side: Setup Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Audio Quick Mute button */}
          <button
            onClick={() => {
              const nextMuted = !soundMuted;
              setSoundMuted(nextMuted);
              SoundEngine.setMuted(nextMuted);
              SoundEngine.playClick();
            }}
            className={`px-1.5 py-1 sm:p-1.5 rounded border font-mono text-[8px] sm:text-[9px] font-bold transition-all cursor-pointer ${
              !soundMuted 
                ? "bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:text-white" 
                : "bg-rose-950/20 border-rose-900 text-rose-400"
            }`}
            aria-label="Mute Audio Synthesizer"
          >
            {soundMuted ? "MUTED" : "SOUND: ON"}
          </button>

          {/* ECU Calibration panel trigger */}
          <button
            onClick={() => {
              SoundEngine.playClick();
              setSettingsOpen(true);
            }}
            className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded bg-porsche-yellow hover:bg-yellow-400 text-zinc-950 font-black font-mono text-[8px] sm:text-[9px] tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-[0_0_10px_rgba(242,211,41,0.15)]"
          >
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" viewBox="0 0 24 24">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.85,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.47,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
            ECU SETUP
          </button>
        </div>
      </header>

      {/* 3. COCKPIT DASHBOARD GRID */}
      <main className="grid grid-cols-12 gap-1.5 sm:gap-3 items-center flex-1 my-1 sm:my-2 overflow-hidden select-none">
        
        {/* LEFT COMPONENT: STEERING WHEEL */}
        <section className="col-span-3 flex justify-center items-center h-full">
          <SteeringWheel 
            steerAngle={steerAngle}
            onSteer={handleSteerChange}
            onHorn={handleHornChange}
          />
        </section>

        {/* CENTER COMPONENT: DIALS INSTRUMENT PANEL */}
        <section className="col-span-6 flex flex-col justify-center items-center h-full p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/45 shadow-inner relative">
          <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-widest block mb-2">
            TELEMETRY HUD METERS
          </span>
          <InstrumentCluster
            speed={speed}
            connected={connected}
            isBraking={isBraking}
            lightsState={lights}
            pingTime={pingTime}
          />
        </section>

        {/* RIGHT COMPONENT: PEDALS & SWITCHES */}
        <section className="col-span-3 flex flex-col justify-between h-full gap-1.5 sm:gap-2 select-none">
          <div className="flex-1">
            <Pedals
              speed={speed}
              isBraking={isBraking}
              onDrive={handleDriveChange}
            />
          </div>
          <div>
            <LightControls
              lightsState={lights}
              onChange={setLights}
            />
          </div>
        </section>
      </main>

      {/* 5. ECU SETUP CALIBRATION POPUP DIALOG */}
      <ConnectionSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        ipAddress={ipAddress}
        setIpAddress={setIpAddress}
        connMode={connMode}
        setConnMode={setConnMode}
        status={status}
        connected={connected}
        onConnect={connectWiFi}
        onDisconnect={disconnectWiFi}
        logs={logs}
        onClearLogs={() => setLogs([])}
        soundMuted={soundMuted}
        setSoundMuted={setSoundMuted}
      />
    </div>
  );
}
