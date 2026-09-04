import { useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type University = { id: string; name: string };

type HomeMarqueeStripProps = {
  universities: University[];
};

export function HomeMarqueeStrip({ universities }: HomeMarqueeStripProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseItems =
    universities.length > 0
      ? universities
      : [{ id: "loading", name: "Loading partner universities…" }];

  const marqueeItems = [...baseItems, ...baseItems];

  return (
    <div
      ref={sectionRef}
      className={cn(
        "relative border-y border-[#5AA3E6]/15 bg-gradient-to-r from-white via-[#f8fbff] to-white py-8 transition-all duration-700",
        inView && "home-marquee-section-active"
      )}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <p
          className={cn(
            "mb-5 flex items-center justify-center gap-2 text-center text-xs uppercase tracking-[0.22em] transition-all duration-500",
            inView
              ? "scale-100 font-black text-[#2B7CD3] opacity-100"
              : "scale-[0.98] font-bold text-slate-400 opacity-80"
          )}
        >
          <Building2
            className={cn(
              "size-4 transition-colors duration-500",
              inView ? "text-[#F7941D]" : "text-[#5AA3E6]"
            )}
          />
          Trusted by partner universities
        </p>

        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border bg-white/70 py-4 shadow-sm backdrop-blur-sm transition-all duration-700",
            inView
              ? "border-[#5AA3E6]/35 shadow-[0_12px_40px_-16px_rgba(43,124,211,0.45)]"
              : "border-slate-200/60"
          )}
        >
          <div
            className={cn(
              "home-marquee-track flex w-max items-center gap-14 px-6",
              inView && universities.length > 0 && "home-marquee-running",
              paused && "home-marquee-paused"
            )}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            aria-label="Partner universities marquee"
          >
            {marqueeItems.map((u, i) => (
              <span
                key={`${u.id}-${i}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-3 whitespace-nowrap transition-all duration-500",
                  inView ? "text-base font-extrabold text-slate-800" : "text-sm font-semibold text-slate-500"
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full transition-all duration-500",
                    inView ? "bg-[#5AA3E6] shadow-[0_0_0_4px_rgba(90,163,230,0.2)]" : "bg-slate-300"
                  )}
                />
                {u.name}
              </span>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white via-white/90 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white via-white/90 to-transparent" />
        </div>
      </div>
    </div>
  );
}
