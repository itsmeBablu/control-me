"use client";

import { useEffect, useRef, useState } from "react";
import SoundEngine from "./SoundEngine";

interface CameraWindscreenProps {
  ipAddress: string;
  connected: boolean;
  steerAngle: number; // 0 to 180 (90 is center)
  speed: number;      // -100 to 100
  isBraking: boolean;
  lightsState: {
    headlights: boolean;
    hazards: boolean;
    neon: boolean;
  };
  addLog: (msg: string) => void;
}

export default function CameraWindscreen({
  ipAddress,
  connected,
  steerAngle,
  speed,
  isBraking,
  lightsState,
  addLog,
}: CameraWindscreenProps) {
  const [wipersOn, setWipersOn] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Wiper animation variables
  const wiperAngleRef = useRef<number>(-Math.PI / 6);
  const wiperDirectionRef = useRef<number>(1); // 1 = right, -1 = left

  // Canvas driving simulator loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    
    // Simulator states
    let distanceTraveled = 0;
    let cameraX = 0;
    let roadCurve = 0;
    let roadCurveTarget = 0;
    let curveTimer = 0;
    
    // Frame rate counting
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsInterval = lastTime;

    // Handle canvas sizing adaptively
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Speed lines
    const speedLines: Array<{ x: number; y: number; length: number; speedMultiplier: number }> = [];
    for (let i = 0; i < 15; i++) {
      speedLines.push({
        x: Math.random() * 2 - 1,
        y: Math.random(),
        length: Math.random() * 20 + 8,
        speedMultiplier: Math.random() * 0.4 + 0.6,
      });
    }

    const drawSim = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) {
        animationFrameId = requestAnimationFrame(drawSim);
        return;
      }
      const horizon = h * 0.45;

      const timeNow = performance.now();
      frameCount++;
      if (timeNow - fpsInterval >= 1000) {
        setFps(Math.round((frameCount * 1000) / (timeNow - fpsInterval)));
        frameCount = 0;
        fpsInterval = timeNow;
      }
      lastTime = timeNow;

      // Speed physics
      const speedVal = speed / 100;
      let velocity = speedVal * 45;
      if (isBraking) velocity = 0;

      distanceTraveled += velocity * 0.1;

      // Steering camera offset
      const steerOffset = (steerAngle - 90) / 90;
      cameraX += steerOffset * (Math.abs(velocity) * 0.08 + 1.2) * 0.2;
      cameraX *= 0.94; // dampening

      // Road curving logic
      curveTimer += 0.01;
      if (curveTimer > 1) {
        curveTimer = 0;
        roadCurveTarget = (Math.random() * 2 - 1) * 1.5;
      }
      roadCurve += (roadCurveTarget - roadCurve) * 0.02;

      // 1. HORIZON AND SKY
      ctx.clearRect(0, 0, w, h);
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
      skyGrad.addColorStop(0, "#080711");
      skyGrad.addColorStop(0.6, "#151025");
      skyGrad.addColorStop(1, "#361b40");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizon);

      // Stars
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 25; i++) {
        const starX = (w * 0.15 * i - cameraX * 0.3) % w;
        const starY = (i * 5) % horizon;
        ctx.fillRect(starX < 0 ? starX + w : starX, starY, 1, 1);
      }

      // Mountains
      ctx.fillStyle = "#1e1328";
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let i = 0; i <= w; i += 25) {
        const mx = i;
        const mountainY = horizon - 15 - Math.sin((i - cameraX * 0.5) * 0.01) * 15 - Math.cos((i - cameraX * 0.2) * 0.005) * 10;
        ctx.lineTo(mx, mountainY);
      }
      ctx.lineTo(w, horizon);
      ctx.closePath();
      ctx.fill();

      // 2. GROUND ENVIRONMENT
      const groundGrad = ctx.createLinearGradient(0, horizon, 0, h);
      groundGrad.addColorStop(0, "#10091c");
      groundGrad.addColorStop(1, "#050308");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizon, w, h - horizon);

      // Perspective grid lines
      ctx.strokeStyle = "#381a4d";
      ctx.lineWidth = 1;
      const numGridLines = 10;
      for (let i = 0; i < numGridLines; i++) {
        const gridX = w / 2 + (i - numGridLines / 2) * (w / 9) - cameraX * 1.2;
        ctx.beginPath();
        ctx.moveTo(gridX, horizon);
        ctx.lineTo(w / 2 + (i - numGridLines / 2) * (w / 1.8) - cameraX * 3.5, h);
        ctx.stroke();
      }

      // Ground speed lines
      const gridSpacing = 40;
      const offset = (distanceTraveled * 1.5) % gridSpacing;
      for (let gy = horizon; gy < h; gy += 15) {
        const ratio = (gy - horizon) / (h - horizon);
        const yPos = horizon + ratio * ratio * (h - horizon) + offset * ratio;
        if (yPos > h) continue;

        ctx.strokeStyle = `rgba(180, 142, 99, ${0.05 + ratio * 0.2})`;
        ctx.lineWidth = 1 + ratio * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(w, yPos);
        ctx.stroke();
      }

      // 3. ROADWAY
      const roadW = w * 0.35;
      const roadH = h - horizon;

      ctx.fillStyle = "#0c0a0f";
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadW / 12 - cameraX, horizon);
      ctx.lineTo(w / 2 + roadW / 12 - cameraX, horizon);
      ctx.lineTo(w / 2 + roadW - cameraX * 3.2, h);
      ctx.lineTo(w / 2 - roadW - cameraX * 3.2, h);
      ctx.closePath();
      ctx.fill();

      // Road lines
      const segments = 30;
      let lastX1 = 0;
      let lastW1 = 0;
      let lastY1 = h;

      for (let i = 0; i < segments; i++) {
        const segRatio = i / segments;
        const py = h - (segRatio * segRatio) * roadH;
        const segmentCurve = Math.sin(segRatio * Math.PI * 0.5) * roadCurve * 60;
        const px = w / 2 + segmentCurve - cameraX * (1 - segRatio * 0.7);
        const pw = roadW * (1 - segRatio * 0.9);

        if (i > 0) {
          const isEven = Math.floor(distanceTraveled * 0.5 - i) % 2 === 0;
          ctx.fillStyle = isEven ? "#f2d329" : "#ffffff";
          
          // Left Curb
          ctx.beginPath();
          ctx.moveTo(lastX1 - lastW1, lastY1);
          ctx.lineTo(px - pw, py);
          ctx.lineTo(px - pw - pw * 0.08, py);
          ctx.lineTo(lastX1 - lastW1 - lastW1 * 0.08, lastY1);
          ctx.closePath();
          ctx.fill();

          // Right Curb
          ctx.beginPath();
          ctx.moveTo(lastX1 + lastW1, lastY1);
          ctx.lineTo(px + pw, py);
          ctx.lineTo(px + pw + pw * 0.08, py);
          ctx.lineTo(lastX1 + lastW1 + lastW1 * 0.08, lastY1);
          ctx.closePath();
          ctx.fill();

          // Center divider
          if (Math.floor(distanceTraveled * 0.4 - i) % 3 === 0) {
            ctx.fillStyle = "rgba(242, 211, 41, 0.85)";
            const dashW = Math.max(1, pw * 0.05);
            ctx.beginPath();
            ctx.moveTo(lastX1 - dashW, lastY1);
            ctx.lineTo(px - dashW, py);
            ctx.lineTo(px + dashW, py);
            ctx.lineTo(lastX1 + dashW, lastY1);
            ctx.closePath();
            ctx.fill();
          }
        }

        lastX1 = px;
        lastW1 = pw;
        lastY1 = py;
      }

      // Headlight Beam overlay
      if (lightsState.headlights) {
        const beamGrad = ctx.createLinearGradient(w / 2, h, w / 2, horizon + 30);
        beamGrad.addColorStop(0, "rgba(255, 253, 220, 0.35)");
        beamGrad.addColorStop(0.4, "rgba(255, 253, 220, 0.15)");
        beamGrad.addColorStop(1, "rgba(255, 253, 220, 0)");
        
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 60, h);
        ctx.lineTo(w / 2 + 60, h);
        ctx.lineTo(w / 2 + roadCurve * 20 - cameraX * 0.5, horizon + 30);
        ctx.closePath();
        ctx.fill();
      }

      // Windshield Glass Glare
      const glareGrad = ctx.createLinearGradient(0, 0, w, h);
      glareGrad.addColorStop(0, "rgba(255, 255, 255, 0.02)");
      glareGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.04)");
      glareGrad.addColorStop(0.48, "rgba(255, 255, 255, 0.0)");
      glareGrad.addColorStop(1, "rgba(255, 255, 255, 0.01)");
      ctx.fillStyle = glareGrad;
      ctx.fillRect(0, 0, w, h);

      // Porsche A-Pillars (Chassis interior borders)
      ctx.fillStyle = "#0c0c0e";
      
      // Left pillar
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.08, 0);
      ctx.bezierCurveTo(w * 0.06, h * 0.4, w * 0.12, h * 0.85, w * 0.14, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Right pillar
      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.92, 0);
      ctx.bezierCurveTo(w * 0.94, h * 0.4, w * 0.88, h * 0.85, w * 0.86, h);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Decal sunband at top of windshield
      ctx.fillStyle = "rgba(12, 12, 14, 0.95)";
      ctx.fillRect(0, 0, w, 22);
      ctx.fillStyle = "rgba(242, 211, 41, 0.75)";
      ctx.fillRect(0, 19, w, 1.5);

      ctx.fillStyle = "#ffffff";
      ctx.font = "italic bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GT2 RS RACING HUD", w / 2, 12);

      // 4. WIPERS ANIMATION
      if (wipersOn) {
        const sweepSpeed = 0.08;
        wiperAngleRef.current += wiperDirectionRef.current * sweepSpeed;

        if (wiperAngleRef.current > Math.PI * 0.7) {
          wiperDirectionRef.current = -1;
          SoundEngine.playClick(400, 0.02, 0.04);
        } else if (wiperAngleRef.current < -Math.PI / 6) {
          wiperDirectionRef.current = 1;
          SoundEngine.playClick(400, 0.02, 0.04);
        }
      } else {
        if (wiperAngleRef.current > -Math.PI / 6) {
          wiperAngleRef.current -= 0.05;
        } else {
          wiperAngleRef.current = -Math.PI / 6;
        }
      }

      const pivotX = w * 0.25;
      const pivotY = h;
      const armLength = h * 0.85;

      const wiperX = pivotX + Math.cos(-wiperAngleRef.current) * armLength;
      const wiperY = pivotY - Math.sin(-wiperAngleRef.current) * armLength;

      ctx.strokeStyle = "#1a1a1e";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(wiperX, wiperY);
      ctx.stroke();

      ctx.strokeStyle = "#08080a";
      ctx.lineWidth = 2;
      const bladeHalfLength = h * 0.16;
      const angleBlade = -wiperAngleRef.current + Math.PI / 2;

      ctx.beginPath();
      ctx.moveTo(
        wiperX - Math.cos(angleBlade) * bladeHalfLength,
        wiperY + Math.sin(angleBlade) * bladeHalfLength
      );
      ctx.lineTo(
        wiperX + Math.cos(angleBlade) * bladeHalfLength,
        wiperY - Math.sin(angleBlade) * bladeHalfLength
      );
      ctx.stroke();

      animationFrameId = requestAnimationFrame(drawSim);
    };

    drawSim();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [speed, steerAngle, wipersOn, isBraking, lightsState.headlights]);

  return (
    <div className="relative w-full h-full min-h-[140px] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/80 shadow-inner">
      {/* 1. MOCK WINDSCREEN DRIVING CANVAS */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full block" 
      />

      {/* 2. HEADS-UP DISPLAY overlay projection */}
      <div className="absolute inset-x-0 bottom-2.5 pointer-events-none flex justify-center z-10 select-none">
        <div className="px-3 py-1 rounded bg-black/75 border border-zinc-800/80 font-mono text-[8px] text-porsche-yellow flex items-center gap-3 glow-yellow">
          <div>SPEED: <span className="font-bold text-white text-glow-yellow">{(Math.abs(speed)).toFixed(0)} KM/H</span></div>
          <div className="h-2 w-[1px] bg-zinc-800" />
          <div>STEER: <span className="font-bold text-white text-glow-yellow">{Math.round((steerAngle - 90) * 6)}°</span></div>
          <div className="h-2 w-[1px] bg-zinc-800" />
          <div>FPS: <span className="font-bold text-white text-glow-yellow">{fps}</span></div>
          <div className="h-2 w-[1px] bg-zinc-800" />
          <div>WIFI: <span className="font-bold text-white text-glow-yellow">{connected ? "100%" : "0%"}</span></div>
        </div>
      </div>

      {/* 3. WIPER TOGGLE CONTROL TOP RIGHT */}
      <div className="absolute top-6 right-3.5 z-20">
        <button
          onClick={() => {
            SoundEngine.playClick();
            setWipersOn(!wipersOn);
          }}
          className={`px-2 py-1 border rounded bg-black/75 text-[8px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer ${
            wipersOn
              ? "border-porsche-yellow text-porsche-yellow"
              : "border-zinc-800/80 text-zinc-500 hover:text-white"
          }`}
        >
          <svg className="w-2.5 h-2.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707" />
          </svg>
          WIPERS: {wipersOn ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
