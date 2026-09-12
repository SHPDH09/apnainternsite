import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/courses/CourseCard";
import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
import { listCategories, listCourses, type Category, type Course } from "@/lib/coursesApi";
import { cn } from "@/lib/utils";

function SubSectionTitle({
  icon,
  title,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
}) {
  return (
    <div className="reveal-on-scroll mb-8 flex items-center gap-3">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/80",
          accent
        )}
      >
        {icon}
      </div>
      <div>
        <h3 className="font-display text-xl font-extrabold text-slate-900 md:text-2xl">{title}</h3>
        <div className="mt-1.5 h-0.5 w-12 rounded-full bg-gradient-to-r from-[#2B7CD3] to-[#F7941D]" />
      </div>
    </div>
  );
}

export function HomeCoursesSections() {
  const sectionRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<Course[]>([]);
  const [latest, setLatest] = useState<Course[]>([]);
  const [popular, setPopular] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [all, cats] = await Promise.all([
          listCourses(supabase, { sort: "newest", limit: 48 }),
          listCategories(supabase, true),
        ]);
        if (!cancelled) {
          setFeatured(all.filter((c) => c.is_featured).slice(0, 4));
          setLatest(all.slice(0, 4));
          setPopular(
            [...all]
              .sort((a, b) => (b.students_count || 0) - (a.students_count || 0))
              .slice(0, 4)
          );
          setCategories(cats);
        }
      } catch (err) {
        console.warn("[courses] home sections load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const root = sectionRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll(".reveal-on-scroll:not(.is-visible)");
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [loading, featured.length, latest.length, popular.length]);

  if (loading) {
    return (
      <section className="home-brand-mesh py-16 md:py-20">
        <div className="mx-auto flex max-w-6xl justify-center px-6 py-12 lg:px-8">
          <Loader2 className="size-8 animate-spin text-[#2B7CD3]" />
        </div>
      </section>
    );
  }

  if (!featured.length && !latest.length && !popular.length) return null;

  return (
    <section
      ref={sectionRef}
      id="courses"
      className="scroll-mt-24 home-brand-mesh border-y border-slate-200/60 py-20 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <HomeSectionHeader
          pill="Learn & Grow"
          title="Explore Our Courses"
          description="Industry-aligned programmes with certificates, live mentorship, and flexible learning — built for students and professionals."
        />

        <div className="reveal-on-scroll mb-14 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat, i) => (
                <Link key={cat.id} to={`/courses?category=${cat.slug}`}>
                  <span
                    className="inline-flex cursor-pointer items-center rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#5AA3E6]/40 hover:bg-white hover:text-[#2B7CD3] hover:shadow-md"
                    style={{ transitionDelay: `${i * 40}ms` }}
                  >
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div />
          )}
          <Button
            variant="outline"
            className="btn-press shrink-0 rounded-full border-[#5AA3E6]/30 bg-white font-bold gap-2 shadow-sm hover:border-[#2B7CD3] hover:bg-[#eef6ff]"
            asChild
          >
            <Link to="/courses">
              View All Courses
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {featured.length > 0 ? (
          <div className="mb-16">
            <SubSectionTitle
              icon={<Sparkles className="size-5 text-emerald-600" />}
              title="Featured Courses"
              accent="text-emerald-600"
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((course, i) => (
                <CourseCard key={course.id} course={course} compact premium revealIndex={i} />
              ))}
            </div>
          </div>
        ) : null}

        {latest.length > 0 ? (
          <div className="mb-16">
            <SubSectionTitle
              icon={<GraduationCap className="size-5 text-[#2B7CD3]" />}
              title="Latest Courses"
              accent="text-[#2B7CD3]"
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {latest.map((course, i) => (
                <CourseCard key={`latest-${course.id}`} course={course} compact premium revealIndex={i} />
              ))}
            </div>
          </div>
        ) : null}

        {popular.length > 0 ? (
          <div>
            <SubSectionTitle
              icon={<TrendingUp className="size-5 text-[#F7941D]" />}
              title="Most Popular"
              accent="text-[#F7941D]"
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((course, i) => (
                <CourseCard key={`pop-${course.id}`} course={course} compact premium revealIndex={i} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
