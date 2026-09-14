import { useMemo, useState } from "react";
import { storageObjectUrlCandidates } from "@/lib/storageUrl";
import { cn } from "@/lib/utils";

type Props = {
  bucket: string;
  path?: string | null;
  url?: string | null;
  alt: string;
  className?: string;
  /** Extra class when image fails to load after all candidates. */
  fallbackClassName?: string;
};

/** Image that tries S3 basename / nested path / legacy URL candidates on error. */
export function StorageImage({
  bucket,
  path,
  url,
  alt,
  className,
  fallbackClassName,
}: Props) {
  const candidates = useMemo(
    () => storageObjectUrlCandidates(bucket, path, url),
    [bucket, path, url]
  );
  const [idx, setIdx] = useState(0);
  const src = candidates[idx] || url?.trim() || "";

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500",
          fallbackClassName || className
        )}
      >
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx + 1 < candidates.length) setIdx((i) => i + 1);
      }}
    />
  );
}
