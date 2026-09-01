import { Check, Lock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type LoginFlowStep = "credentials" | "verification" | "complete";

type LoginStepIndicatorProps = {
  step: LoginFlowStep;
  className?: string;
};

const STEPS: { key: LoginFlowStep; label: string; icon: typeof Lock }[] = [
  { key: "credentials", label: "Sign in", icon: Lock },
  { key: "verification", label: "Verify", icon: Shield },
  { key: "complete", label: "Access", icon: Check },
];

function stepIndex(step: LoginFlowStep): number {
  if (step === "credentials") return 0;
  if (step === "verification") return 1;
  return 2;
}

export function LoginStepIndicator({ step, className }: LoginStepIndicatorProps) {
  const active = stepIndex(step);

  return (
    <div className={cn("mb-8", className)}>
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((item, index) => {
          const Icon = item.icon;
          const isDone = index < active;
          const isCurrent = index === active;

          return (
            <div key={item.key} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center gap-2">
                <div
                  className={cn(
                    "relative flex size-11 items-center justify-center rounded-full border-2 transition-all duration-500",
                    isDone && "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]",
                    isCurrent &&
                      "border-primary bg-primary/10 text-primary shadow-[0_0_24px_rgba(90,163,230,0.35)] login-step-pulse",
                    !isDone && !isCurrent && "border-slate-200 bg-white text-slate-400"
                  )}
                >
                  {isDone ? <Check className="size-5" /> : <Icon className="size-5" />}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    isCurrent ? "text-primary" : isDone ? "text-emerald-600" : "text-slate-400"
                  )}
                >
                  {item.label}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <div className="mx-2 mb-6 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-700 ease-out",
                      index < active ? "w-full" : "w-0"
                    )}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
