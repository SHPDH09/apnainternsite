import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, Clock, Loader2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BlogMarkdownContent } from "@/components/blog/BlogMarkdownContent";
import { BlogReaderShell } from "@/components/blog/BlogReaderShell";
import {
  estimateReadMinutes,
  fetchPublicBlogPostBySlug,
  formatBlogDate,
  type SiteBlogPost,
} from "@/lib/siteBlogApi";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<SiteBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const row = await fetchPublicBlogPostBySlug(supabase, slug);
        if (cancelled) return;
        if (!row) setNotFound(true);
        else {
          setPost(row);
          document.title = `${row.meta_title || row.title} · Apna Intern`;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <BlogReaderShell>
        <div className="flex justify-center py-24">
          <Loader2 className="size-8 animate-spin text-[#5AA3E6]" />
        </div>
      </BlogReaderShell>
    );
  }

  if (notFound || !post) {
    return (
      <BlogReaderShell>
        <div className="py-16 text-center">
          <h1 className="font-serif text-2xl font-bold text-slate-900">Post not found</h1>
          <p className="mt-2 text-slate-600">This article may be unpublished or removed.</p>
          <Link to="/blog" className="mt-6 inline-block text-sm font-semibold text-[#2563eb] hover:underline">
            ← Back to blog
          </Link>
        </div>
      </BlogReaderShell>
    );
  }

  const tags = Array.isArray(post.tags) ? post.tags : [];

  return (
    <BlogReaderShell>
      <article className="blog-article">
        {post.cover_image_url ? (
          <div className="-mx-4 mb-8 overflow-hidden rounded-2xl sm:-mx-0 sm:mb-10">
            <img
              src={post.cover_image_url}
              alt=""
              className="aspect-[16/9] w-full object-cover sm:aspect-[2/1]"
            />
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 capitalize">{post.post_type}</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatBlogDate(post.published_at || post.scheduled_at || post.created_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {estimateReadMinutes(post.content)} min read
          </span>
        </div>

        <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
          {post.title}
        </h1>

        {post.excerpt ? (
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{post.excerpt}</p>
        ) : null}

        <p className="mt-4 text-sm font-medium text-slate-500">By {post.author_name || "Apna Intern"}</p>

        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
              >
                <Tag className="size-3 opacity-60" />
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="my-10 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <BlogMarkdownContent content={post.content} />
      </article>
    </BlogReaderShell>
  );
}
