import { Shield, Lock, Cpu, Sparkles, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function Login3DHologramBadge() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex flex-col items-center justify-center p-6 my-2 select-none"
      style={{ perspective: "1000px" }}
    >
      {/* 3D Floating Hologram Container */}
      <div
        className="relative size-48 md:size-52 flex items-center justify-center transition-transform duration-700 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: isHovered
            ? "rotateX(12deg) rotateY(-12deg) scale(1.05)"
            : "rotateX(0deg) rotateY(0deg) scale(1)",
        }}
      >
        {/* Background Ambient Aura */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/25 via-blue-500/35 to-amber-400/20 blur-2xl animate-pulse" />

        {/* Outer 3D Gyroscope Orbit Ring */}
        <div
          className="absolute inset-0 rounded-full border border-cyan-400/35 border-dashed"
          style={{
            animation: "spin 16s linear infinite",
            transform: "rotateX(60deg) translateZ(10px)",
          }}
        >
          {/* Orbiting dot */}
          <div className="absolute -top-1 left-1/2 size-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#38bdf8]" />
        </div>

        {/* Counter Orbit Ring */}
        <div
          className="absolute inset-3 rounded-full border border-blue-300/40"
          style={{
            animation: "spin 22s linear infinite reverse",
            transform: "rotateY(55deg) translateZ(18px)",
          }}
        >
          <div className="absolute top-1/2 -left-1 size-2 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
        </div>

        {/* 3D Floating Hexagonal Shield Core */}
        <div
          className="relative z-10 flex size-28 md:size-32 items-center justify-center rounded-3xl bg-gradient-to-br from-white/20 via-white/10 to-transparent p-1 backdrop-blur-xl border border-white/40 shadow-[0_15px_35px_rgba(0,0,0,0.25)] transition-all duration-500"
          style={{
            transform: isHovered ? "translateZ(45px)" : "translateZ(20px)",
            boxShadow: isHovered
              ? "0 25px 50px -12px rgba(56, 189, 248, 0.45), inset 0 1px 1px rgba(255,255,255,0.7)"
              : "0 15px 35px -8px rgba(30, 58, 95, 0.4), inset 0 1px 1px rgba(255,255,255,0.5)",
          }}
        >
          <div className="relative flex size-full items-center justify-center rounded-[22px] bg-gradient-to-b from-[#1e3a5f]/80 to-[#0f172a]/90 text-white overflow-hidden">
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full animate-[loginScanLine_4s_ease-in-out_infinite]" />

            {/* Glowing Shield Icon */}
            <Shield className="size-14 text-cyan-300 drop-shadow-[0_0_16px_rgba(56,189,248,0.7)] transition-transform duration-500" />
            <Lock className="absolute size-6 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          </div>
        </div>

        {/* Floating 3D Micro-Chips */}
        <div
          className="absolute -top-1 -right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-cyan-400/50 backdrop-blur-md text-[10px] font-bold text-cyan-300 shadow-lg transition-transform duration-500"
          style={{
            transform: isHovered ? "translateZ(55px) translateY(-4px)" : "translateZ(25px)",
          }}
        >
          <Cpu className="size-3 text-cyan-400 animate-spin-slow" />
          <span>256-Bit TLS</span>
        </div>

        <div
          className="absolute -bottom-2 -left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-amber-400/50 backdrop-blur-md text-[10px] font-bold text-amber-300 shadow-lg transition-transform duration-500"
          style={{
            transform: isHovered ? "translateZ(50px) translateY(4px)" : "translateZ(22px)",
          }}
        >
          <CheckCircle2 className="size-3 text-emerald-400" />
          <span>Verified Auth</span>
        </div>
      </div>

      {/* Real-time Telemetry Pill */}
      <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs text-white/90">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-semibold tracking-wide">99.98% Gateway Active</span>
        <span className="text-white/40">•</span>
        <span className="text-cyan-200 font-mono text-[11px]">Sub-120ms</span>
      </div>
    </div>
  );
}
