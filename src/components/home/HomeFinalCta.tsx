import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CERT_BADGES } from "./HomeTrustSection";

type HomeFinalCtaProps = {
  onRegister: () => void;
  onVerify: () => void;
};

export function HomeFinalCta({ onRegister, onVerify }: HomeFinalCtaProps) {
  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="reveal-on-scroll relative overflow-hidden rounded-[2rem] border border-[#5AA3E6]/20 bg-gradient-to-br from-[#1e3a5f] via-[#2563eb] to-[#5AA3E6] text-white shadow-glow">
          <div className="pointer-events-none absolute inset-0 opacity-30 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.12)_50%,transparent_60%)] animate-login-scan-line" />
          <div className="relative grid lg:grid-cols-2">
            <div className="relative px-8 py-12 md:px-12 md:py-14">
              <div className="mb-6">
                <BrandLogo size="sm" className="brightness-0 invert opacity-95" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">Ready when you are</p>
              <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
                Start your internship journey today
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-sky-100/90">
                Join thousands of students earning UGC-aligned credits with live training, mentor
                support, and verifiable certificates.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="btn-press rounded-full bg-white px-8 font-bold text-[#2B7CD3] hover:bg-sky-50"
                  onClick={onRegister}
                >
                  Register now
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-press rounded-full border-white/30 bg-white/10 px-8 font-semibold text-white backdrop-blur hover:bg-white/15"
                  onClick={onVerify}
                >
                  Verify certificate
                </Button>
              </div>
            </div>

            <div className="border-t border-white/15 bg-white/5 px-8 py-10 backdrop-blur-sm lg:border-l lg:border-t-0">
              <p className="mb-6 text-center text-xs font-bold uppercase tracking-widest text-sky-200/80 lg:text-left">
                Recognised & certified
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CERT_BADGES.map((b) => (
                  <div
                    key={b.t}
                    className="flex flex-col items-center rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm transition-transform hover:-translate-y-0.5"
                  >
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-white p-1">
                      <img
                        src={`/certifications/${b.img}`}
                        alt={b.t}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <span className="text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-sky-100/90">
                      {b.t}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
