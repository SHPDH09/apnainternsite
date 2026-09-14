import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import { formatBlogDate, type SiteBlogPost } from "@/lib/siteBlogApi";

type Props = {
  posts: SiteBlogPost[];
};

export function HomeBlogSection({ posts }: Props) {
  if (!posts.length) return null;

  return (
    <section className="border-t border-slate-200/80 bg-white py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5AA3E6]">From our blog</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-slate-900">Latest insights</h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563eb] hover:underline"
          >
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-[#fafbfc] shadow-sm transition hover:border-[#5AA3E6]/30 hover:shadow-md"
            >
              {post.cover_image_url ? (
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={post.cover_image_url}
                    alt=""
                    className="size-full object-cover transition group-hover:scale-[1.03]"
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-gradient-to-br from-[#5AA3E6]/20 to-slate-100" />
              )}
              <div className="p-5">
                <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Calendar className="size-3" />
                  {formatBlogDate(post.published_at || post.created_at)}
                </p>
                <h3 className="mt-2 line-clamp-2 font-serif text-lg font-bold text-slate-900 group-hover:text-[#2563eb]">
                  {post.title}
                </h3>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
