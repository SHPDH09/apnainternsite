import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  GraduationCap,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { BRAND_TAGLINE } from "@/lib/brand";

type HomeHeroSectionProps = {
  onRegister: () => void;
  onVerify: () => void;
};

const TRUST_TAGS = ["UGC Compliant", "NEP-2020 Aligned", "ISO 9001:2015", "AICTE Registered"];

export function HomeHeroSection({ onRegister, onVerify }: HomeHeroSectionProps) {
  return (
    <section id="hero" className="relative overflow-hidden border-b border-sky-200/50">
      {/* Branded ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#eef6ff] via-white to-[#fff8ef]" aria-hidden>
        <div className="absolute -left-24 top-8 h-[30rem] w-[30rem] rounded-full bg-[#5AA3E6]/25 blur-3xl animate-login-float-orb" />
        <div className="absolute right-[-4rem] top-1/3 h-[22rem] w-[22rem] rounded-full bg-[#F7941D]/15 blur-3xl animate-login-float-orb [animation-delay:2s]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_42%,rgba(90,163,230,0.05)_50%,transparent_58%)] animate-login-scan-line" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.18) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24 lg:pt-20">
        <div className="animate-fade-in-up text-center lg:text-left">
          <div className="mb-5 flex justify-center lg:justify-start">
            <BrandLogo size="md" className="drop-shadow-sm" />
          </div>

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#5AA3E6]/25 bg-white/90 px-4 py-2 text-sm font-semibold text-[#2B7CD3] shadow-sm backdrop-blur">
            <Sparkles className="size-4 text-[#F7941D]" />
            {BRAND_TAGLINE} · UGC internships · Pan India
          </div>

          <h1 className="font-display text-[2.35rem] font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.35rem]">
            Launch your career with a{" "}
            <span className="home-text-gradient">verified internship</span> programme
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 lg:mx-0 lg:text-lg">
            Apna Intern connects undergraduate students to structured 120-hour programmes, live
            mentorship, and instantly verifiable certificates recognised by partner universities
            across Bihar and India.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Button
              size="lg"
              className="btn-press h-12 w-full rounded-full bg-gradient-to-r from-[#2B7CD3] to-[#5AA3E6] px-8 text-base font-bold text-white shadow-glow hover:opacity-95 sm:w-auto"
              onClick={onRegister}
            >
              Start registration
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="btn-press h-12 w-full rounded-full border-[#5AA3E6]/35 bg-white/85 px-8 text-base font-semibold text-slate-800 backdrop-blur hover:bg-white sm:w-auto"
              onClick={onVerify}
            >
              <ShieldCheck className="mr-2 size-4 text-[#2B7CD3]" />
              Verify certificate
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {TRUST_TAGS.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80 shadow-sm"
              >
                <BadgeCheck className="size-3.5 text-[#5AA3E6]" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[#5AA3E6]/20 to-[#F7941D]/10 blur-2xl" aria-hidden />
          <div className="relative grid grid-cols-6 gap-3 sm:gap-4">
            <div className="home-card-premium col-span-6 overflow-hidden rounded-3xl p-2 ring-1 ring-white/70">
              <img
                src="/student_real.png"
                alt="Student completing an online internship"
                className="aspect-[5/4] w-full rounded-2xl object-cover"
              />
            </div>

            <div className="home-card-premium col-span-3 rounded-2xl p-4">
              <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-[#5AA3E6]/10 text-[#2B7CD3]">
                <GraduationCap className="size-5" />
              </div>
              <p className="font-display text-2xl font-extrabold text-slate-900">120</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Training hours · 4 credits
              </p>
            </div>

            <div className="col-span-3 rounded-2xl border border-[#2B7CD3]/30 bg-gradient-to-br from-[#1e3a5f] via-[#2563eb] to-[#5AA3E6] p-4 text-white shadow-elegant">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-200">Live classes</p>
              <p className="mt-2 font-display text-lg font-bold leading-tight">
                YouTube · Meet · Recordings
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-100/90">
                <PlayCircle className="size-3.5" /> Flexible schedule
              </div>
            </div>

            <div className="col-span-6 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-950">QR-verified certificates</p>
                  <p className="text-xs text-emerald-800/80">Public verify portal for employers</p>
                </div>
              </div>
              <Link
                to="/verify"
                className="shrink-0 text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline"
              >
                Try it
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
