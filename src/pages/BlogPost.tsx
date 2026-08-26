import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublicBlogPostBySlug,
  formatBlogDate,
  type SiteBlogPost,
} from "@/lib/siteBlogApi";

export default function BlogPost() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<SiteBlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setPost(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPublicBlogPostBySlug(supabase, slug)
      .then(setPost)
      .catch((err) => {
        console.warn("[blog-post] fetch failed:", err);
        setPost(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      <SiteNav />

      <main className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <Button
          type="button"
          variant="ghost"
          className="mb-6 -ml-2 gap-2 text-slate-500 hover:text-slate-900"
          onClick={() => navigate("/blog")}
        >
          <ArrowLeft className="size-4" /> All posts
        </Button>

        {loading ? (
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : !post ? (
          <Card className="border-dashed p-12 text-center">
            <p className="text-lg font-semibold text-slate-800">Post not found</p>
            <p className="mt-2 text-sm text-slate-500">
              This article may have been removed or is not published yet.
            </p>
            <Button asChild className="mt-6 rounded-full">
              <Link to="/blog">Back to blog</Link>
            </Button>
          </Card>
        ) : (
          <article>
            <header className="mb-8 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Blog</p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  {formatBlogDate(post.published_at || post.created_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-4" />
                  {post.author_name || "Apna Intern"}
                </span>
              </div>
              {post.excerpt ? (
                <p className="text-lg leading-relaxed text-slate-600">{post.excerpt}</p>
              ) : null}
            </header>

            {post.cover_image_url ? (
              <div className="mb-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft">
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full object-cover"
                />
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-soft md:p-8">
              <div className="prose prose-slate max-w-none whitespace-pre-wrap text-base leading-8 text-slate-700">
                {post.content}
              </div>
            </div>
          </article>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
