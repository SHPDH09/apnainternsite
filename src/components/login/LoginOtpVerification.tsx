import type { ReactNode } from "react";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LoginSecurityCheck } from "@/components/login/LoginSecurityCheck";

type LoginOtpVerificationProps = {
  headline: string;
  description: ReactNode;
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  verifyLabel?: string;
  loading?: boolean;
  sending?: boolean;
  captchaVerified: boolean;
  verifyingCaptcha: boolean;
  onVerifyCaptcha: () => void;
  onResend?: () => void;
  resendLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  showCaptcha?: boolean;
  devOtpHint?: string | null;
  slotSize?: "md" | "lg";
  childrenBeforeOtp?: ReactNode;
};

export function LoginOtpVerification({
  headline,
  description,
  otp,
  onOtpChange,
  onVerify,
  verifyLabel = "Verify code & sign in",
  loading = false,
  sending = false,
  captchaVerified,
  verifyingCaptcha,
  onVerifyCaptcha,
  onResend,
  resendLabel = "Resend code",
  onBack,
  backLabel = "Back to password sign-in",
  showCaptcha = true,
  devOtpHint,
  slotSize = "md",
  childrenBeforeOtp,
}: LoginOtpVerificationProps) {
  const slotClass =
    slotSize === "lg"
      ? "size-14 text-2xl rounded-xl border-2 font-black"
      : "size-12 text-xl rounded-xl border-2 font-black";

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-sky-50 px-4 py-4">
        <div className="absolute top-0 right-0 size-24 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative flex gap-3">
          <div className="relative shrink-0 mt-0.5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="size-5" strokeWidth={2.2} />
            </div>
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
              <MailCheck className="size-3" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{headline}</p>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">{description}</p>
          </div>
        </div>
      </div>

      {devOtpHint ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 animate-fade-in">
          <p className="font-bold text-xs uppercase tracking-wide text-amber-800 mb-1">Dev / fallback code</p>
          <p>
            Verification code:{" "}
            <span className="font-mono text-lg font-black tracking-[0.25em]">{devOtpHint}</span>
          </p>
        </div>
      ) : null}

      {childrenBeforeOtp}

      <div className="flex flex-col items-center gap-3 py-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Enter 6-digit code</p>
        <InputOTP maxLength={6} value={otp} onChange={onOtpChange} onComplete={() => void onVerify()}>
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className={`${slotClass} border-primary/35 bg-white shadow-sm transition-all focus-within:animate-login-otp-glow data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/25`}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Code expires in a few minutes
        </div>
      </div>

      {showCaptcha ? (
        <LoginSecurityCheck
          verified={captchaVerified}
          verifying={verifyingCaptcha}
          onVerify={onVerifyCaptcha}
          showBrandBadge={false}
        />
      ) : null}

      <Button
        type="button"
        className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-glow transition-all disabled:opacity-50"
        disabled={loading || sending || (showCaptcha && !captchaVerified) || otp.length !== 6}
        onClick={() => void onVerify()}
      >
        {loading ? <Loader2 className="size-5 animate-spin mr-2" /> : null}
        {verifyLabel}
      </Button>

      <div className="flex flex-col items-center gap-2 text-center">
        {onResend ? (
          <button
            type="button"
            className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
            disabled={sending}
            onClick={() => void onResend()}
          >
            {sending ? "Sending…" : resendLabel}
          </button>
        ) : null}
        {onBack ? (
          <button type="button" className="text-xs font-bold text-slate-500 hover:underline" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
