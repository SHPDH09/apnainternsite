import { Loader2, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

type CriticalOtpVerificationProps = {
  email: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  verifying: boolean;
  sending: boolean;
  otpSent: boolean;
  transitioning?: boolean;
  devOtp?: string | null;
  captchaVerified: boolean;
  verifyingCaptcha: boolean;
  onVerifyCaptcha: () => void;
  showEmailField?: boolean;
  onEmailChange?: (value: string) => void;
  onSendCode?: () => void;
  title?: string;
  subtitle?: string;
};

export function CriticalOtpVerification({
  email,
  otp,
  onOtpChange,
  onVerify,
  onResend,
  onBack,
  verifying,
  sending,
  otpSent,
  transitioning = false,
  devOtp,
  captchaVerified,
  verifyingCaptcha,
  onVerifyCaptcha,
  showEmailField = false,
  onEmailChange,
  onSendCode,
  title = "Critical security verification",
  subtitle,
}: CriticalOtpVerificationProps) {
  return (
    <div className="critical-verify-shell relative overflow-hidden rounded-2xl border border-slate-800/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
      <div className="critical-verify-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="critical-verify-scan pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-primary/0 via-primary/20 to-primary/0" />

      <div className="relative space-y-5">
        <div className="flex items-start gap-4">
          <div className="critical-shield-wrap relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <ShieldCheck className="size-7 text-sky-300" />
            <span className="critical-shield-ring absolute inset-0 rounded-2xl border border-sky-400/40" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300/90">
              Secure checkpoint
            </p>
            <h2 className="font-display text-lg font-bold tracking-tight text-white">{title}</h2>
            <p className="text-sm leading-relaxed text-slate-300">
              {transitioning
                ? "Encrypting session and preparing your verification challenge…"
                : subtitle ||
                  (otpSent
                    ? `Enter the 6-digit code sent to ${email || "your email"}.`
                    : "Confirm your identity with a one-time verification code.")}
            </p>
          </div>
        </div>

        {transitioning ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-10">
            <Loader2 className="size-8 animate-spin text-sky-300" />
            <p className="text-sm font-semibold text-slate-200">Initiating verification protocol</p>
            <div className="flex gap-1">
              <span className="critical-dot size-2 rounded-full bg-sky-400" />
              <span className="critical-dot size-2 rounded-full bg-sky-400 [animation-delay:150ms]" />
              <span className="critical-dot size-2 rounded-full bg-sky-400 [animation-delay:300ms]" />
            </div>
          </div>
        ) : (
          <>
            {showEmailField ? (
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Registered email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => onEmailChange?.(e.target.value.trim().toLowerCase())}
                    className="h-12 border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Verifying access for{" "}
                <span className="font-semibold text-white">{email || "your account"}</span>
              </div>
            )}

            {devOtp ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Dev code</p>
                <p className="mt-1 font-mono text-xl font-black tracking-[0.25em]">{devOtp}</p>
              </div>
            ) : null}

            {!otpSent && showEmailField && onSendCode ? (
              <Button
                type="button"
                className="h-12 w-full rounded-xl bg-sky-500 font-bold text-white hover:bg-sky-400"
                disabled={sending || !email.includes("@")}
                onClick={onSendCode}
              >
                {sending ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
                Send verification code
              </Button>
            ) : otpSent ? (
              <>
                <div className="flex flex-col items-center gap-4 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Enter secure code
                  </p>
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={onOtpChange}
                    onComplete={onVerify}
                  >
                    <InputOTPGroup className="gap-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className={cn(
                            "size-12 rounded-xl border-2 border-sky-400/30 bg-slate-950/80 text-xl font-black text-white",
                            "data-[active=true]:border-sky-300 data-[active=true]:shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                          )}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all select-none",
                    captchaVerified
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:border-sky-400/30"
                  )}
                  onClick={onVerifyCaptcha}
                >
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded border transition-all",
                      captchaVerified
                        ? "border-emerald-400 bg-emerald-500"
                        : verifyingCaptcha
                          ? "border-transparent"
                          : "border-white/20 bg-slate-900"
                    )}
                  >
                    {verifyingCaptcha ? (
                      <Loader2 className="size-5 animate-spin text-sky-300" />
                    ) : captchaVerified ? (
                      <svg
                        className="size-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      captchaVerified ? "text-emerald-300" : "text-slate-300"
                    )}
                  >
                    {verifyingCaptcha
                      ? "Running security check…"
                      : captchaVerified
                        ? "Human verification passed"
                        : "Complete human verification"}
                  </span>
                </div>

                <Button
                  type="button"
                  className="h-12 w-full rounded-xl bg-sky-500 font-bold text-white hover:bg-sky-400 disabled:opacity-50"
                  disabled={verifying || sending || !captchaVerified || otp.length !== 6}
                  onClick={onVerify}
                >
                  {verifying ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
                  Verify & authorize access
                </Button>
              </>
            ) : null}
          </>
        )}

        {!transitioning && otpSent ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:underline disabled:opacity-50"
              disabled={sending}
              onClick={onResend}
            >
              <RefreshCw className={cn("size-3.5", sending && "animate-spin")} />
              {sending ? "Resending code…" : "Resend verification code"}
            </button>
            <button
              type="button"
              className="text-xs font-bold text-slate-400 hover:text-white hover:underline"
              onClick={onBack}
            >
              Back to sign in
            </button>
          </div>
        ) : !transitioning && !otpSent && showEmailField ? (
          <button
            type="button"
            className="w-full text-center text-xs font-bold text-slate-400 hover:text-white hover:underline"
            onClick={onBack}
          >
            Back to password sign-in
          </button>
        ) : null}
      </div>
    </div>
  );
}
