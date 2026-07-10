"use client";

import { useEffect, useRef, useState } from "react";
import SoundEngine from "./SoundEngine";

interface SteeringWheelProps {
  steerAngle: number; // 0 to 180 (90 is center)
  onSteer: (angle: number) => void;
  onHorn: (active: boolean) => void;
}

export default function SteeringWheel({
  steerAngle,
  onSteer,
  onHorn,
}: SteeringWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<{ [key: string]: boolean }>({});
  
  // Track consecutive pointer rotation positions and multi-rotation accumulations
  const lastPointerAngleRef = useRef<number | null>(null);
  const wheelRotationRef = useRef<number>(0);

  // Spring-return velocity (servo-degrees/frame). Persists across re-renders so
  // the wheel keeps its momentum between animation frames.
  const returnVelocityRef = useRef<number>(0);

  // Keyboard driving listeners (A/D or ArrowLeft/ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) {
        // Prevent viewport movement
        if (document.activeElement?.tagName !== "INPUT") {
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

  // Frame loop for keyboard steering & spring return physics
  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;

      const leftPressed = pressedKeys["arrowleft"] || pressedKeys["a"];
      const rightPressed = pressedKeys["arrowright"] || pressedKeys["d"];

      if (leftPressed || rightPressed) {
        // Steer using keyboard
        // Lock-to-lock is now wider (540 deg either side vs 90 deg either side).
        // Scaling keyboard step size so it remains highly responsive but smooth.
        // A step of 2.0 in servo degrees turns the wheel by 12 degrees. 
        // 540 / 12 = 45 frames (0.75 seconds to full lock) which feels very realistic.
        const step = rightPressed ? 2.0 : -2.0;
        const nextAngle = Math.max(0, Math.min(180, steerAngle + step));
        if (nextAngle !== steerAngle) {
          onSteer(Math.round(nextAngle));
        }
      } else if (!isDragging && steerAngle !== 90) {
        // ── Real steering spring-return physics ──────────────────────────────
        // Simulates power-steering self-centering: a spring pulls the wheel
        // toward 90 and damping bleeds off accumulated velocity each frame.
        //
        //   spring coefficient  k  = 0.028   (gentle pull — lower = slower start)
        //   damping coefficient  c  = 0.82    (1.0 = no damping, 0.0 = instant stop)
        //   dead-zone                ≤ 0.15   (avoids endless micro-jitter at center)
        //
        // The model: v(t+1) = (v(t) + k * diff) * c
        // ──────────────────────────────────────────────────────────────────────
        const k = 0.028;   // spring stiffness — increase for snappier return
        const c = 0.82;    // damping factor   — increase for less resistance

        const diff = 90 - steerAngle;

        // Accelerate toward center, then damp
        returnVelocityRef.current = (returnVelocityRef.current + k * diff) * c;

        const next = steerAngle + returnVelocityRef.current;

        if (Math.abs(diff) < 0.15) {
          // Close enough — snap clean to center and kill velocity
          returnVelocityRef.current = 0;
          onSteer(90);
        } else {
          onSteer(Math.round(Math.max(0, Math.min(180, next))));
        }
      } else if (!isDragging && steerAngle === 90) {
        // Already centered — kill residual velocity
        returnVelocityRef.current = 0;
      }

      requestAnimationFrame(tick);
    };

    const frameId = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [pressedKeys, isDragging, steerAngle, onSteer]);

  // Pointer drag math
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    
    // Capture starting pointer angle to establish delta base
    if (wheelRef.current) {
      const rect = wheelRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      lastPointerAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
    }
    
    // Sync starting reference rotation to current servo state
    // steerAngle 90 = 0 deg rotation, steerAngle 0 = -540 deg, steerAngle 180 = 540 deg.
    wheelRotationRef.current = (steerAngle - 90) * 6;
    SoundEngine.playClick(800, 0.03, 0.05);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateAngle(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    lastPointerAngleRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // Snap back immediately due to spring return
    onSteer(90);
  };

  const updateAngle = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * (180 / Math.PI);

    if (lastPointerAngleRef.current === null) {
      lastPointerAngleRef.current = angleDeg;
      wheelRotationRef.current = (steerAngle - 90) * 6;
      return;
    }

    let delta = angleDeg - lastPointerAngleRef.current;
    
    // Correct wrap-around delta triggers (jumps between 180 and -180)
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    let nextRotation = wheelRotationRef.current + delta;
    
    // Clamp to 1.5 full rotations (540 degrees) in either direction
    nextRotation = Math.max(-540, Math.min(540, nextRotation));

    wheelRotationRef.current = nextRotation;
    lastPointerAngleRef.current = angleDeg;

    // Convert -540..540 wheel rotation to 0..180 servo degrees
    // (nextRotation / 6) translates back to standard [-90, 90] bounds.
    const nextServoAngle = Math.round(90 + nextRotation / 6);
    onSteer(nextServoAngle);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Steering Container */}
      <div 
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] md:w-[170px] md:h-[170px] lg:w-[190px] lg:h-[190px] rounded-full carbon-fiber flex items-center justify-center p-1.5 relative shadow-[inset_0_0_15px_rgba(0,0,0,0.8),0_8px_16px_rgba(0,0,0,0.6)] border-2 border-zinc-800/80 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{
          transform: `rotate(${(steerAngle - 90) * 6}deg)`,
          transition: isDragging ? "none" : "transform 0.08s cubic-bezier(0.1, 0.8, 0.3, 1)",
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 200 200" className="pointer-events-none select-none">
          {/* Alcantara wrap/Rim */}
          <circle cx="100" cy="100" r="88" fill="none" stroke="#1c1c1f" strokeWidth="16" />
          
          {/* Inner stitch rings (Yellow stitching) */}
          <circle cx="100" cy="100" r="95" fill="none" stroke="#f2d329" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
          <circle cx="100" cy="100" r="81" fill="none" stroke="#f2d329" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
          
          {/* Metallic Gold rim trim */}
          <circle cx="100" cy="100" r="79" fill="none" stroke="#b48e63" strokeWidth="1.5" opacity="0.55" />

          {/* Spokes (Carbon fiber texture) */}
          {/* Left Spoke */}
          <path d="M 22 100 L 76 100 Q 76 112 85 118" fill="none" stroke="#161619" strokeWidth="12" strokeLinecap="round" />
          <path d="M 22 100 L 76 100" fill="none" stroke="#f2d329" strokeWidth="1.5" opacity="0.4" />

          {/* Right Spoke */}
          <path d="M 178 100 L 124 100 Q 124 112 115 118" fill="none" stroke="#161619" strokeWidth="12" strokeLinecap="round" />
          <path d="M 178 100 L 124 100" fill="none" stroke="#f2d329" strokeWidth="1.5" opacity="0.4" />

          {/* Bottom Spoke */}
          <path d="M 100 178 L 100 126 Q 92 126 86 118" fill="none" stroke="#161619" strokeWidth="12" strokeLinecap="round" />
          <line x1="100" y1="178" x2="100" y2="126" stroke="#f2d329" strokeWidth="1.5" opacity="0.4" />

          {/* Center Horn Cap (With Porsche shield frame) */}
          <circle cx="100" cy="100" r="28" fill="#111" stroke="#b48e63" strokeWidth="2.5" />
          <circle cx="100" cy="100" r="22" fill="#0d0d0e" />
          
          {/* Central Logo */}
          <path d="M 96,93 L 104,93 L 103,103 L 100,107 L 97,103 Z" fill="#f2d329" stroke="#b48e63" strokeWidth="0.5" />
          <text x="100" y="112" fill="#888" fontSize="5" fontWeight="black" textAnchor="middle" letterSpacing="0.5">GT2 RS</text>

          {/* Yellow 12 o'clock alignment stripe */}
          <rect x="97" y="6" width="6" height="12" fill="#f2d329" rx="1.5" />
        </svg>

        {/* Central interactive horn button trigger */}
        <div 
          onPointerDown={(e) => {
            e.stopPropagation();
            onHorn(true);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onHorn(false);
          }}
          onPointerLeave={() => {
            onHorn(false);
          }}
          className="absolute w-14 h-14 rounded-full cursor-pointer flex items-center justify-center z-30"
          title="Press Horn"
        />
      </div>

      {/* Degree feedback */}
      <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
        STEER: <span className="text-porsche-yellow font-bold">{Math.round((steerAngle - 90) * 6)}°</span>
      </span>
    </div>
  );
}
