import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

type LoginSecurityCheckProps = {
  verified: boolean;
  verifying: boolean;
  onVerify: () => void;
  showBrandBadge?: boolean;
};

export function LoginSecurityCheck({
  verified,
  verifying,
  onVerify,
  showBrandBadge = true,
}: LoginSecurityCheckProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onVerify();
      }}
      className={`group flex items-center gap-4 p-4 border rounded-xl transition-all duration-300 cursor-pointer select-none shadow-inner
        ${verified ? "border-emerald-400/80 bg-emerald-50/60" : "border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-primary/[0.03]"}
      `}
      onClick={onVerify}
    >
      <div
        className={`relative flex items-center justify-center size-9 rounded-lg border transition-all duration-500
          ${verified ? "bg-emerald-500 border-emerald-500 scale-105" : verifying ? "border-transparent bg-white" : "bg-white border-slate-300 group-hover:border-primary/50"}
        `}
      >
        {verifying ? (
          <Loader2 className="size-5 text-primary animate-spin" />
        ) : verified ? (
          <svg
            className="size-5 text-white animate-fade-in"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="size-4 rounded-sm border-2 border-slate-300 group-hover:border-primary/60 transition-colors" />
        )}
        {verified ? (
          <span className="absolute -inset-1 rounded-lg border border-emerald-400/40 animate-login-shield-pulse pointer-events-none" />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-bold block transition-colors ${verified ? "text-emerald-700" : "text-slate-600"}`}
        >
          {verifying ? "Verifying security…" : verified ? "Human verification passed" : "Verify you are human"}
        </span>
        <span className="text-[11px] text-slate-400 font-medium">Protected sign-in layer</span>
      </div>
      {showBrandBadge ? (
        <div className="ml-auto opacity-40 flex items-center gap-1 shrink-0">
          <BrandLogo variant="icon" size="xs" className="w-5 h-5 grayscale" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Secure</span>
        </div>
      ) : null}
    </div>
  );
}
