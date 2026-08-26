import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBlogDate, type SiteBlogPost } from "@/lib/siteBlogApi";

type HomeBlogSectionProps = {
  posts: SiteBlogPost[];
  loading?: boolean;
};

export function HomeBlogSection({ posts, loading }: HomeBlogSectionProps) {
  if (!loading && posts.length === 0) return null;

  return (
    <section id="blog" className="scroll-mt-24 bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="reveal-on-scroll mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Insights</p>
            <h2 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Latest from our blog
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
              Internship tips, program updates, and student success stories from the Apna Intern team.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/blog">
              View all posts <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="reveal-on-scroll overflow-hidden border-slate-200/80 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <Link to={`/blog/${post.slug}`} className="block">
                  <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="size-full object-cover transition duration-500 hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-slate-400">
                        <BookOpen className="size-10" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        {formatBlogDate(post.published_at || post.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3.5" />
                        {post.author_name || "Apna Intern"}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold leading-snug text-slate-900">
                      {post.title}
                    </h3>
                    <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
                      {post.excerpt || post.content.slice(0, 160)}
                    </p>
                    <span className="inline-flex items-center text-sm font-semibold text-primary">
                      Read article <ArrowRight className="ml-1 size-4" />
                    </span>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
