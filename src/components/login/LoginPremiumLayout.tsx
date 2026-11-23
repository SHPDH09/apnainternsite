import type { ReactNode } from "react";
import { Sparkles, Award, ShieldCheck, Zap, Lock } from "lucide-react";
import { Login3DScene } from "./Login3DScene";
import { Login3DCard } from "./Login3DCard";
import { Login3DHologramBadge } from "./Login3DHologramBadge";
import { LoginPortalSelector } from "./LoginPortalSelector";

type LoginPremiumLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  badge?: string;
};

export function LoginPremiumLayout({ title, subtitle, children, badge }: LoginPremiumLayoutProps) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-stretch overflow-hidden bg-slate-950">
      {/* Global Ambient 3D Nebula & Particle Backdrop for all screen sizes */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 size-[550px] rounded-full bg-blue-600/15 blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 size-[550px] rounded-full bg-cyan-500/15 blur-[120px] animate-pulse-slow [animation-delay:2s]" />
        <div className="absolute top-1/2 left-1/3 size-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
      </div>

      {/* Branded Showcase Panel — Desktop 3D Experience */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[44%] relative overflow-hidden bg-gradient-to-br from-[#0c182b] via-[#112a4a] to-[#0a192f] text-white p-8 xl:p-12 flex-col justify-between z-10 border-r border-cyan-500/15 shadow-[15px_0_50px_rgba(0,0,0,0.5)]">
        {/* Interactive 3D Canvas in Showcase Panel */}
        <div className="absolute inset-0 z-0 opacity-85">
          <Login3DScene interactive={true} density="high" showCentralPolyhedron={true} />
        </div>

        {/* Ambient Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c182b] via-transparent to-[#0c182b]/60 pointer-events-none z-[1]" />

        {/* Top Header & Badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/50 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-cyan-300 backdrop-blur-md shadow-[0_0_15px_rgba(56,189,248,0.2)] mb-4">
            <Sparkles className="size-3.5 text-amber-300 animate-spin-slow" />
            {badge || "Next-Gen 3D Secure Portal"}
          </div>
          <h2 className="font-display text-3xl xl:text-4xl font-black leading-tight max-w-md tracking-tight text-white drop-shadow-sm">
            Empowering Careers Through Real-World Internships
          </h2>
          <p className="mt-3 text-sm text-slate-300 max-w-sm leading-relaxed font-medium">
            AICTE-aligned verification, real-time certificate authentication, and end-to-end encrypted portal sign-in.
          </p>
        </div>

        {/* Center 3D Hologram Badge */}
        <div className="relative z-10 my-auto py-2">
          <Login3DHologramBadge />
        </div>

        {/* Bottom Feature Pill Grid */}
        <div className="relative z-10 space-y-3">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-md hover:bg-white/10 transition-colors">
              <ShieldCheck className="size-5 text-cyan-400 mb-1" />
              <p className="text-[11px] font-bold text-white">ISO 9001:2015</p>
              <p className="text-[9px] text-slate-400">Quality Certified</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-md hover:bg-white/10 transition-colors">
              <Zap className="size-5 text-amber-400 mb-1" />
              <p className="text-[11px] font-bold text-white">Instant QR Auth</p>
              <p className="text-[9px] text-slate-400">Live Verification</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-md hover:bg-white/10 transition-colors">
              <Award className="size-5 text-emerald-400 mb-1" />
              <p className="text-[11px] font-bold text-white">AICTE Aligned</p>
              <p className="text-[9px] text-slate-400">National Standard</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/10">
            <span className="flex items-center gap-1.5 font-medium">
              <Lock className="size-3 text-cyan-400" /> 256-Bit SSL Encrypted
            </span>
            <span className="text-slate-400 font-mono">Apna Intern v3.0</span>
          </div>
        </div>
      </div>

      {/* Form Panel with 3D Tilt Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 md:p-10 relative z-10 bg-gradient-to-br from-slate-900/90 via-slate-950/95 to-slate-900/90 backdrop-blur-md">
        {/* Mobile-only background particle canvas */}
        <div className="lg:hidden absolute inset-0 z-0 opacity-40 pointer-events-none">
          <Login3DScene interactive={true} density="low" showCentralPolyhedron={false} />
        </div>

        <div className="w-full max-w-lg relative z-10">
          {/* Portal Switcher Dock */}
          <LoginPortalSelector />

          {/* 3D Tilt Card Wrapper */}
          <Login3DCard
            maxTilt={6}
            perspective={1200}
            scale={1.008}
            className="w-full"
          >
            <div className="rounded-3xl border border-white/15 bg-white/[0.96] dark:bg-slate-900/90 p-6 sm:p-8 md:p-10 shadow-[0_25px_60px_-15px_rgba(30,58,95,0.45)] backdrop-blur-2xl">
              {/* Form Title & Subtitle */}
              <div className="text-center sm:text-left mb-6">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <div className="size-2 rounded-full bg-cyan-500 animate-ping" />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                    Secure Authentication
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-1.5">
                  {subtitle}
                </p>
              </div>

              {/* Form Body */}
              <div className="relative">
                {children}
              </div>
            </div>
          </Login3DCard>
        </div>
      </div>
    </div>
  );
}
