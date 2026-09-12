import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BlogReaderShell } from "@/components/blog/BlogReaderShell";
import {
  estimateReadMinutes,
  fetchPublicBlogPosts,
  formatBlogDate,
  type SiteBlogPost,
} from "@/lib/siteBlogApi";

export default function Blog() {
  const [posts, setPosts] = useState<SiteBlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchPublicBlogPosts(supabase);
        if (!cancelled) setPosts(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BlogReaderShell backTo="/" backLabel="Home">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5AA3E6]">Apna Intern</p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Blog &amp; Vlog
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
          Internship tips, career guidance, and updates from the Apna Intern team.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-8 animate-spin text-[#5AA3E6]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center">
          <p className="text-slate-500">No published posts yet. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:border-[#5AA3E6]/30 hover:shadow-lg"
            >
              {post.cover_image_url ? (
                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={post.cover_image_url}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-gradient-to-br from-[#5AA3E6]/20 to-slate-100" />
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {post.is_featured ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#5AA3E6]/10 px-2 py-0.5 font-semibold text-[#2563eb]">
                      <Sparkles className="size-3" /> Featured
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    {formatBlogDate(post.published_at || post.scheduled_at || post.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {estimateReadMinutes(post.content)} min read
                  </span>
                </div>
                <h2 className="mt-3 line-clamp-2 font-serif text-lg font-bold text-slate-900 group-hover:text-[#2563eb]">
                  {post.title}
                </h2>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
                    {post.excerpt}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                <p className="mt-4 text-xs font-medium text-slate-400">{post.author_name || "Apna Intern"}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BlogReaderShell>
  );
}
