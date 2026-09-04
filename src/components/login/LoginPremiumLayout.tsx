import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Shield, Sparkles } from "lucide-react";

type LoginPremiumLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  badge?: string;
};

export function LoginPremiumLayout({ title, subtitle, children, badge }: LoginPremiumLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-stretch">
      {/* Branded panel — desktop */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#2563eb] to-[#5AA3E6] text-white p-10 xl:p-12 flex-col justify-between">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-3xl animate-login-float-orb" />
        <div className="absolute bottom-10 -left-16 size-56 rounded-full bg-[#fbbf24]/20 blur-2xl animate-login-float-orb [animation-delay:1.5s]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)] animate-login-scan-line pointer-events-none" />

        <div className="relative z-10">
          <Link to="/" className="inline-flex mb-10">
            <BrandLogo size="lg" className="brightness-0 invert drop-shadow-lg" />
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm mb-6">
            <Sparkles className="size-3.5 text-amber-300" />
            {badge || "Secure portal access"}
          </div>
          <h2 className="font-display text-3xl xl:text-4xl font-extrabold leading-tight max-w-md">
            Trusted access for students, staff & partners
          </h2>
          <p className="mt-4 text-sm text-white/80 max-w-sm leading-relaxed">
            Encrypted sign-in with OTP verification, session protection, and Apna Intern branding on every step.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <div className="relative flex size-14 items-center justify-center rounded-2xl bg-white/15">
            <div className="absolute inset-0 rounded-2xl border border-white/30 animate-login-shield-pulse" />
            <Shield className="size-7 text-amber-300 relative z-10" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-sm font-bold">256-bit protected session</p>
            <p className="text-xs text-white/70 mt-0.5">OTP codes expire quickly · never share your PIN</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 bg-gradient-to-b from-slate-50 to-white">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="inline-flex">
              <BrandLogo size="lg" />
            </Link>
          </div>
          <div className="text-center mb-8 lg:text-left">
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2">{subtitle}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-elegant">{children}</div>
        </div>
      </div>
    </div>
  );
}
