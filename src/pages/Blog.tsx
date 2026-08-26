import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Calendar, User } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicBlogPosts, formatBlogDate, type SiteBlogPost } from "@/lib/siteBlogApi";

export default function Blog() {
  const [posts, setPosts] = useState<SiteBlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPublicBlogPosts(supabase)
      .then(setPosts)
      .catch((err) => {
        console.warn("[blog] public fetch failed:", err);
        setPosts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
        <div className="mb-10">
          <Link
            to="/"
            className="mb-4 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="mr-2 size-4" /> Back to home
          </Link>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Blog</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-slate-900">
            Apna Intern Blog
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Updates, internship guidance, and stories from our community.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="border-dashed p-12 text-center">
            <BookOpen className="mx-auto mb-4 size-10 text-slate-300" />
            <p className="text-lg font-semibold text-slate-800">No blog posts yet</p>
            <p className="mt-2 text-sm text-slate-500">Check back soon for new articles.</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden border-slate-200/80 bg-white shadow-soft">
                <Link to={`/blog/${post.slug}`} className="block h-full">
                  <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="size-full object-cover"
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
                    <h2 className="font-display text-xl font-bold text-slate-900">{post.title}</h2>
                    <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
                      {post.excerpt || post.content.slice(0, 180)}
                    </p>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
