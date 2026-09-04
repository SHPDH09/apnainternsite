import type { CSSProperties, ReactNode } from "react";
import * as React from "react";
import { Check, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { OTPInputContext } from "input-otp";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup } from "@/components/ui/input-otp";
import { LoginSecurityCheck } from "@/components/login/LoginSecurityCheck";
import { cn } from "@/lib/utils";

const OTP_SLOT_COUNT = 6;
const OTP_VERIFY_STAGGER_MS = 90;

type LoginOtpVerificationProps = {
  headline: string;
  description: ReactNode;
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  verifyLabel?: string;
  loading?: boolean;
  sending?: boolean;
  verified?: boolean;
  verifying?: boolean;
  error?: boolean;
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

type LoginOtpRoundSlotProps = {
  index: number;
  slotSize: "md" | "lg";
  verified: boolean;
  verifying: boolean;
  error: boolean;
};

function LoginOtpRoundSlot({ index, slotSize, verified, verifying, error }: LoginOtpRoundSlotProps) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  const sizeClass =
    slotSize === "lg" ? "size-14 text-2xl font-black" : "size-12 text-xl font-black";

  const slotStyle: CSSProperties | undefined = verified
    ? { animationDelay: `${index * OTP_VERIFY_STAGGER_MS}ms` }
    : verifying
      ? { animationDelay: `${index * 120}ms` }
      : undefined;

  return (
    <div className="relative" style={slotStyle}>
      <div
        data-active={isActive}
        className={cn(
          "relative flex items-center justify-center rounded-full border-2 bg-white shadow-sm transition-colors duration-300",
          sizeClass,
          verified
            ? "login-otp-slot-verified border-emerald-500 bg-emerald-500 text-white"
            : error
              ? "login-otp-slot-error border-red-400 bg-red-50 text-red-700"
              : verifying
                ? "login-otp-slot-scanning border-primary/50 text-primary"
                : "border-primary/35 text-slate-900 focus-within:animate-login-otp-glow data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/25",
        )}
      >
        <span
          className={cn(
            "relative z-[1] tabular-nums transition-all duration-300",
            verified && "login-otp-digit-match opacity-0 scale-75",
          )}
        >
          {char}
        </span>

        {verified ? (
          <span
            className="absolute inset-0 z-[2] flex items-center justify-center login-otp-check-pop"
            style={{ animationDelay: `${index * OTP_VERIFY_STAGGER_MS + 120}ms` }}
          >
            <Check className={slotSize === "lg" ? "size-6" : "size-5"} strokeWidth={3} />
          </span>
        ) : null}

        {!verified && hasFakeCaret ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="animate-caret-blink h-5 w-px bg-primary duration-1000" />
          </div>
        ) : null}

        {verified ? (
          <span
            className="pointer-events-none absolute -inset-1 rounded-full border-2 border-emerald-400/50 login-otp-verified-ring"
            style={{ animationDelay: `${index * OTP_VERIFY_STAGGER_MS + 80}ms` }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function LoginOtpVerification({
  headline,
  description,
  otp,
  onOtpChange,
  onVerify,
  verifyLabel = "Verify code & sign in",
  loading = false,
  sending = false,
  verified = false,
  verifying = false,
  error = false,
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
  const otpLocked = verified || verifying;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border px-4 py-4 transition-all duration-500",
          verified
            ? "border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40"
            : "border-primary/20 bg-gradient-to-br from-primary/5 via-white to-sky-50",
        )}
      >
        <div className="absolute top-0 right-0 size-24 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative flex gap-3">
          <div className="relative shrink-0 mt-0.5">
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-xl transition-all duration-500",
                verified ? "bg-emerald-500 text-white scale-105" : "bg-primary/15 text-primary",
              )}
            >
              {verified ? (
                <Check className="size-5 login-otp-check-pop" strokeWidth={2.8} />
              ) : verifying ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ShieldCheck className="size-5" strokeWidth={2.2} />
              )}
            </div>
            <span
              className={cn(
                "absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-white transition-colors duration-500",
                verified ? "bg-emerald-600" : "bg-emerald-500",
              )}
            >
              <MailCheck className="size-3" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {verified ? "Code verified" : verifying ? "Verifying code…" : headline}
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              {verified ? "Digits matched. Signing you in securely…" : description}
            </p>
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
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-300",
            verified ? "text-emerald-600" : error ? "text-red-500" : "text-slate-400",
          )}
        >
          {verified ? "Verified" : error ? "Code did not match" : "Enter 6-digit code"}
        </p>

        <InputOTP
          maxLength={OTP_SLOT_COUNT}
          value={otp}
          onChange={onOtpChange}
          onComplete={() => {
            if (!otpLocked) void onVerify();
          }}
          disabled={otpLocked}
        >
          <InputOTPGroup className="gap-2.5">
            {Array.from({ length: OTP_SLOT_COUNT }, (_, index) => (
              <LoginOtpRoundSlot
                key={index}
                index={index}
                slotSize={slotSize}
                verified={verified}
                verifying={verifying && !verified}
                error={error && !verified}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {verified ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700 login-otp-verified-banner">
            <Check className="size-3.5" strokeWidth={3} />
            OTP verified · All digits matched
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                verifying ? "bg-primary animate-pulse" : "bg-emerald-500 animate-pulse",
              )}
            />
            {verifying ? "Matching your digits…" : "Code expires in a few minutes"}
          </div>
        )}
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
        className={cn(
          "w-full h-12 font-black rounded-xl shadow-glow transition-all disabled:opacity-50",
          verified
            ? "bg-emerald-600 hover:bg-emerald-600 text-white"
            : "bg-primary hover:bg-primary/90 text-white",
        )}
        disabled={loading || sending || (showCaptcha && !captchaVerified) || otp.length !== OTP_SLOT_COUNT || verified}
        onClick={() => void onVerify()}
      >
        {loading || verifying ? <Loader2 className="size-5 animate-spin mr-2" /> : verified ? <Check className="size-5 mr-2" /> : null}
        {verified ? "Verified" : verifyLabel}
      </Button>

      <div className="flex flex-col items-center gap-2 text-center">
        {onResend ? (
          <button
            type="button"
            className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
            disabled={sending || otpLocked}
            onClick={() => void onResend()}
          >
            {sending ? "Sending…" : resendLabel}
          </button>
        ) : null}
        {onBack ? (
          <button
            type="button"
            className="text-xs font-bold text-slate-500 hover:underline disabled:opacity-50"
            disabled={otpLocked}
            onClick={onBack}
          >
            {backLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const OTP_VERIFIED_ANIMATION_MS = OTP_SLOT_COUNT * OTP_VERIFY_STAGGER_MS + 320;
