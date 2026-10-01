import { cn } from "@/lib/utils";

type Props = {
  active?: boolean;
  className?: string;
};

/** Gemini-inspired animated orb (CSS 3D, no WebGL dependency). */
export function GeminiVoiceOrb({ active = false, className }: Props) {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ perspective: "800px" }}
      aria-hidden
    >
      <div
        className={cn(
          "absolute size-44 rounded-full bg-gradient-to-br from-violet-500 via-sky-400 to-teal-300 opacity-90 blur-md transition-transform duration-700",
          active && "animate-pulse scale-110"
        )}
      />
      <div
        className={cn(
          "relative size-36 rounded-full shadow-2xl transition-transform duration-500",
          active && "gemini-orb-spin"
        )}
        style={{
          transformStyle: "preserve-3d",
          background:
            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), rgba(186,230,253,0.5) 35%, rgba(99,102,241,0.85) 70%, rgba(30,27,75,0.9))",
          boxShadow:
            "0 0 60px rgba(56,189,248,0.45), inset 0 -12px 40px rgba(79,70,229,0.35)",
        }}
      >
        <div
          className="absolute inset-3 rounded-full opacity-60"
          style={{
            background:
              "conic-gradient(from 120deg, rgba(255,255,255,0.7), transparent, rgba(167,139,250,0.8), transparent)",
            transform: "translateZ(12px)",
          }}
        />
      </div>
      <div
        className={cn(
          "absolute size-52 rounded-full border border-white/20",
          active && "gemini-orb-ring"
        )}
      />
    </div>
  );
}
