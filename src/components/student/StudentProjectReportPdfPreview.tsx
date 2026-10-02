import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjectReportDomainTemplate } from "@/lib/projectReportSettings";
import {
  previewProjectReportPdfUrl,
  type ProjectReportGenerateInput,
} from "@/lib/projectReportPdf";
import { pickWorkingStorageUrl } from "@/lib/storageUrl";
import { ProjectReportPreviewDocument } from "@/components/student/ProjectReportPreviewDocument";

type Props = {
  generateInput: ProjectReportGenerateInput | null;
  uploadedUrlCandidates?: string[];
  issueDate?: string;
  active: boolean;
};

export function StudentProjectReportPdfPreview({
  generateInput,
  uploadedUrlCandidates = [],
  issueDate,
  active,
}: Props) {
  const htmlFallbackRef = useRef<HTMLDivElement>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useHtmlFallback, setUseHtmlFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const uploadedKey = useMemo(() => uploadedUrlCandidates.join("|"), [uploadedUrlCandidates]);
  const generateKey = useMemo(
    () =>
      generateInput
        ? `${generateInput.universityName}|${generateInput.domain}|${generateInput.student?.registrationNumber || ""}`
        : "",
    [generateInput]
  );

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const revokeBlob = () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };

    void (async () => {
      setLoading(true);
      setError(null);
      setUseHtmlFallback(false);
      setPdfSrc(null);
      revokeBlob();

      try {
        if (uploadedUrlCandidates.length > 0) {
          const remote = await pickWorkingStorageUrl(uploadedUrlCandidates);
          if (remote && !cancelled) {
            setPdfSrc(remote);
            return;
          }
        }

        if (!generateInput) {
          if (!cancelled) setError("Add university and internship domain in your profile.");
          return;
        }

        const template = await fetchProjectReportDomainTemplate(supabase, generateInput.domain);
        if (!template?.template_pdf_url) {
          if (!cancelled) setUseHtmlFallback(true);
          return;
        }

        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        const url = await previewProjectReportPdfUrl(
          template,
          generateInput,
          htmlFallbackRef.current
        );
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        blobUrlRef.current = url;
        setPdfSrc(url);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load project report preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revokeBlob();
    };
  }, [active, generateKey, uploadedKey, issueDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-600">
        <Loader2 className="size-8 animate-spin text-[#5AA3E6]" />
        <p className="text-sm font-medium">Preparing your project report preview…</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 text-center py-8 px-4">{error}</p>;
  }

  if (pdfSrc) {
    return (
      <iframe
        title="Project report preview"
        src={pdfSrc}
        className="w-full min-h-[75vh] rounded-lg border border-slate-200 bg-white shadow-sm"
      />
    );
  }

  if (useHtmlFallback && generateInput) {
    return (
      <ProjectReportPreviewDocument
        ref={htmlFallbackRef}
        universityName={generateInput.universityName}
        universityLogoUrl={generateInput.universityLogoUrl}
        domain={generateInput.domain}
        mode={generateInput.mode}
        issueDate={issueDate}
      />
    );
  }

  return null;
}
