import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LoginAnimatedStepProps = {
  stepKey: string;
  children: ReactNode;
  className?: string;
};

export function LoginAnimatedStep({ stepKey, children, className }: LoginAnimatedStepProps) {
  return (
    <div key={stepKey} className={cn("login-step-enter", className)}>
      {children}
    </div>
  );
}
