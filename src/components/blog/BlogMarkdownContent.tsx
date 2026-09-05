import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

/** Renders blog markdown: # headings, **bold**, links, images, lists, blockquotes. */
export function BlogMarkdownContent({ content, className }: Props) {
  return (
    <div
      className={cn(
        "blog-markdown prose prose-slate max-w-none",
        "prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900",
        "prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl",
        "prose-p:text-[17px] prose-p:leading-[1.75] prose-p:text-slate-700",
        "prose-a:text-[#2563eb] prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-slate-900 prose-strong:font-semibold",
        "prose-img:rounded-2xl prose-img:border prose-img:border-slate-200/80 prose-img:shadow-md prose-img:my-8",
        "prose-blockquote:border-l-[#5AA3E6] prose-blockquote:bg-slate-50 prose-blockquote:py-1 prose-blockquote:rounded-r-lg",
        "prose-li:text-slate-700",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          img: ({ src, alt, ...props }) => (
            <figure className="my-8">
              <img
                src={src}
                alt={alt || ""}
                className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200/80 shadow-md"
                loading="lazy"
                {...props}
              />
              {alt ? (
                <figcaption className="mt-2 text-center text-sm text-slate-500">{alt}</figcaption>
              ) : null}
            </figure>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
