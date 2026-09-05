import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  className?: string;
};

/** Full-screen blog shell — no site header/footer (mobile + desktop). */
export function BlogReaderShell({ children, backTo = "/blog", backLabel = "All posts", className }: Props) {
  return (
    <div className={cn("blog-reader-shell min-h-[100dvh] bg-[#fafbfc] text-slate-900", className)}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(90,163,230,0.12),transparent)]" />
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BookOpen className="size-4 text-[#5AA3E6]" />
            Apna Intern
          </Link>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:max-w-4xl lg:py-14">
        {children}
      </main>
    </div>
  );
}
