import { useBlogMediaSrc } from "@/hooks/useBlogMediaSrc";

type Props = {
  url: string;
  className?: string;
};

export function BlogCoverImage({ url, className }: Props) {
  const src = useBlogMediaSrc(url);
  if (!src) return null;
  return <img src={src} alt="" className={className} loading="lazy" />;
}
