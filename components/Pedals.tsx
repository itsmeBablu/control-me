"use client";

import { useEffect, useRef, useState } from "react";
import SoundEngine from "./SoundEngine";

interface PedalsProps {
  speed: number; // -100 to 100
  isBraking: boolean;
  onDrive: (speed: number, braking: boolean) => void;
}

export default function Pedals({
  speed,
  isBraking,
  onDrive,
}: PedalsProps) {
  const [gasActive, setGasActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  
  // Track pointer IDs for multi-touch
  const gasPointerId = useRef<number | null>(null);
  const brakePointerId = useRef<number | null>(null);

  // Keyboard driving listeners
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["w", "s", "arrowup", "arrowdown"].includes(e.key.toLowerCase())) {
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
        }
        keysPressed.current[e.key.toLowerCase()] = true;
        updateKeyboardDrive();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["w", "s", "arrowup", "arrowdown"].includes(e.key.toLowerCase())) {
        keysPressed.current[e.key.toLowerCase()] = false;
        updateKeyboardDrive();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [speed]);

  const updateKeyboardDrive = () => {
    const gas = keysPressed.current["w"] || keysPressed.current["arrowup"];
    const brake = keysPressed.current["s"] || keysPressed.current["arrowdown"];

    setGasActive(!!gas);
    setBrakeActive(!!brake);

    let nextSpeed = 0;
    let nextBraking = false;

    if (gas && brake) {
      // Both pressed -> braking active
      nextSpeed = 0;
      nextBraking = true;
    } else if (gas) {
      // Accelerate forward
      nextSpeed = 100;
      nextBraking = false;
    } else if (brake) {
      // Brake or Reverse
      if (speed > 0) {
        nextSpeed = 0;
        nextBraking = true;
      } else {
        nextSpeed = -70; // reverse speed capped
        nextBraking = false;
      }
    }

    onDrive(nextSpeed, nextBraking);
  };

  // Touch handlers for Accelerator (Gas)
  const handleGasDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    gasPointerId.current = e.pointerId;
    setGasActive(true);
    SoundEngine.playClick(900, 0.03, 0.04);
    
    // Smooth pedal acceleration
    let targetSpeed = 100;
    if (brakeActive) {
      onDrive(0, true);
    } else {
      onDrive(targetSpeed, false);
    }
  };

  const handleGasUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gasPointerId.current === e.pointerId) {
      setGasActive(false);
      gasPointerId.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      // Decelerate
      if (brakeActive) {
        onDrive(speed > 0 ? 0 : -70, true);
      } else {
        onDrive(0, false);
      }
    }
  };

  // Touch handlers for Brake
  const handleBrakeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    brakePointerId.current = e.pointerId;
    setBrakeActive(true);
    SoundEngine.playClick(600, 0.04, 0.05);

    if (speed > 0) {
      // Slowing down
      onDrive(0, true);
    } else {
      // Reverse if already stopped
      onDrive(-70, false);
    }
  };

  const handleBrakeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (brakePointerId.current === e.pointerId) {
      setBrakeActive(false);
      brakePointerId.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      if (gasActive) {
        onDrive(100, false);
      } else {
        onDrive(0, false);
      }
    }
  };

  // Smooth pedal animation styles
  // When active, rotate slightly around X axis to mimic depression
  const gasTransform = gasActive
    ? "perspective(300px) rotateX(15deg) translateY(6px)"
    : "perspective(300px) rotateX(0deg) translateY(0)";

  const brakeTransform = brakeActive
    ? "perspective(300px) rotateX(15deg) translateY(6px)"
    : "perspective(300px) rotateX(0deg) translateY(0)";

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6 p-2.5 sm:p-4 bg-zinc-900/30 border border-zinc-800/40 rounded-2xl relative select-none h-full">
      {/* Background metal panel grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:10px_10px] opacity-15 pointer-events-none" />

      {/* BRAKE PEDAL (Left, shorter, wider) */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          onPointerDown={handleBrakeDown}
          onPointerUp={handleBrakeUp}
          onPointerCancel={handleBrakeUp}
          onPointerLeave={handleBrakeUp}
          style={{ transform: brakeTransform }}
          className={`w-[45px] h-[75px] sm:w-[55px] sm:h-[90px] md:w-[60px] md:h-[100px] rounded-xl flex flex-col justify-between p-1 sm:p-2 select-none touch-none cursor-pointer transition-all duration-75 border-t border-l border-zinc-600 ${
            brakeActive ? "pedal-metal-active" : "pedal-metal"
          }`}
        >
          {/* Metal ridges */}
          <div className="flex justify-between w-full px-1">
            <span className="w-0.5 h-3 sm:w-1.5 sm:h-5 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-3 sm:w-1.5 sm:h-5 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-3 sm:w-1.5 sm:h-5 bg-zinc-700/80 rounded-full" />
          </div>
          
          <span className="font-bold text-[8px] sm:text-[9px] font-mono text-zinc-500 uppercase tracking-tight text-center">
            {speed > 0 ? "BRAKE" : "REV"}
          </span>

          <div className="flex justify-between w-full px-1">
            <span className="w-0.5 h-3 sm:w-1.5 sm:h-5 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-3 sm:w-1.5 sm:h-5 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-3 sm:w-1.5 sm:h-5 bg-zinc-700/80 rounded-full" />
          </div>
        </div>
        <span className="font-mono text-[7px] sm:text-[8px] text-zinc-500 tracking-wider">[S] PEDAL</span>
      </div>

      {/* ACCELERATOR PEDAL (Right, longer, narrower) */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          onPointerDown={handleGasDown}
          onPointerUp={handleGasUp}
          onPointerCancel={handleGasUp}
          onPointerLeave={handleGasUp}
          style={{ transform: gasTransform }}
          className={`w-[35px] h-[95px] sm:w-[45px] sm:h-[110px] md:w-[50px] md:h-[125px] rounded-xl flex flex-col justify-between p-1 sm:p-2 select-none touch-none cursor-pointer transition-all duration-75 border-t border-l border-zinc-600 ${
            gasActive ? "pedal-metal-active" : "pedal-metal"
          }`}
        >
          {/* Metal ridges */}
          <div className="flex justify-between w-full px-1">
            <span className="w-0.5 h-4 sm:w-1 sm:h-7 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-4 sm:w-1 sm:h-7 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-4 sm:w-1 sm:h-7 bg-zinc-700/80 rounded-full" />
          </div>
          
          <span className="font-bold text-[8px] sm:text-[9px] font-mono text-zinc-500 uppercase tracking-tight text-center rotate-270 translate-y-0.5">
            GAS
          </span>

          <div className="flex justify-between w-full px-1">
            <span className="w-0.5 h-4 sm:w-1 sm:h-7 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-4 sm:w-1 sm:h-7 bg-zinc-700/80 rounded-full" />
            <span className="w-0.5 h-4 sm:w-1 sm:h-7 bg-zinc-700/80 rounded-full" />
          </div>
        </div>
        <span className="font-mono text-[7px] sm:text-[8px] text-zinc-500 tracking-wider">[W] PEDAL</span>
      </div>
    </div>
  );
}
