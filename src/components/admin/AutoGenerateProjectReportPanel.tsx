import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { resolveStorageUrl } from "@/lib/storageUrl";
import {
  fetchProjectReportSettings,
  saveProjectReportTemplate,
  type ProjectReportSettings,
} from "@/lib/projectReportSettings";
import {
  PROJECT_REPORT_MODES,
  type ProjectReportMode,
} from "@/lib/projectReportDomainContent";
import {
  downloadProjectReportPdf,
  previewProjectReportPdfUrl,
  type ProjectReportGenerateInput,
} from "@/lib/projectReportPdf";
import { ProjectReportPreviewDocument } from "@/components/student/ProjectReportPreviewDocument";

type UniversityRow = {
  id: string;
  name: string;
  logo_url?: string | null;
};

type DomainRow = {
  id: string;
  name: string;
};

type Props = {
  unis: UniversityRow[];
  domains: DomainRow[];
  currentUserId?: string | null;
  isActive?: boolean;
};

export function AutoGenerateProjectReportPanel({
  unis,
  domains,
  currentUserId,
  isActive = true,
}: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [settings, setSettings] = useState<ProjectReportSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [universityId, setUniversityId] = useState("");
  const [domain, setDomain] = useState("");
  const [mode, setMode] = useState<ProjectReportMode>("Online");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedUniversity = useMemo(
    () => unis.find((u) => u.id === universityId) || null,
    [unis, universityId]
  );

  const domainOptions = useMemo(() => {
    const names = new Set<string>();
    for (const d of domains) {
      const n = String(d.name || "").trim();
      if (n) names.add(n);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [domains]);

  const generateInput = useMemo<ProjectReportGenerateInput | null>(() => {
    if (!selectedUniversity || !domain.trim()) return null;
    return {
      universityName: selectedUniversity.name,
      universityLogoUrl: selectedUniversity.logo_url,
      domain: domain.trim(),
      mode,
    };
  }, [selectedUniversity, domain, mode]);

  const canGenerate = !!generateInput && (!!settings?.template_pdf_url || true);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const row = await fetchProjectReportSettings(supabase);
      setSettings(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load template settings.";
      toast.error(msg);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) void loadSettings();
  }, [isActive, loadSettings]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const revokePreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  };

  const handleTemplateUpload = async (file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    setUploadingTemplate(true);
    try {
      const saved = await saveProjectReportTemplate(supabase, {
        file,
        uploadedBy: currentUserId,
      });
      setSettings(saved);
      toast.success("Project report template uploaded.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Template upload failed.";
      toast.error(msg);
    } finally {
      setUploadingTemplate(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  };

  const runGenerate = async (action: "preview" | "download") => {
    if (!generateInput) {
      toast.error("Select university and domain first.");
      return;
    }

    setGenerating(true);
    try {
      const htmlEl = previewRef.current;
      if (action === "preview") {
        revokePreviewUrl();
        const url = await previewProjectReportPdfUrl(settings, generateInput, htmlEl);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPreviewOpen(true);
        toast.success("Report generated. Preview ready.");
      } else {
        await downloadProjectReportPdf(settings, generateInput, htmlEl);
        toast.success("Report downloaded.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not generate report.";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const logoSrc = selectedUniversity?.logo_url
    ? resolveStorageUrl(selectedUniversity.logo_url) || selectedUniversity.logo_url
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-[#5AA3E6]" />
          Auto Generate Project Report
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a standard project report PDF template, then generate university-specific reports
          with dynamic name, logo, domain, and mode fields.
        </p>
      </div>

      <Card className="p-6 border-none shadow-elegant space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Report Template</h3>
            <p className="text-sm text-muted-foreground">
              Upload or replace the master PDF template. Format and static content stay unchanged;
              only dynamic fields are overlaid at generation time.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSettings()}
            disabled={loadingSettings}
          >
            <RefreshCw className={`size-4 mr-1.5 ${loadingSettings ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loadingSettings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading template settings…
          </div>
        ) : settings?.template_pdf_url ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 p-4">
            <Badge variant="secondary" className="font-semibold">
              Template active
            </Badge>
            <span className="text-sm font-medium">{settings.template_file_name || "Project_Report_Template.pdf"}</span>
            {settings.updated_at ? (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(settings.updated_at).toLocaleString("en-IN")}
              </span>
            ) : null}
            <Button type="button" variant="ghost" size="sm" asChild className="ml-auto">
              <a href={settings.template_pdf_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4 mr-1" />
                View template
              </a>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50/50 p-4 text-sm text-amber-900">
            No template uploaded yet. Reports will use the built-in HTML layout until you upload a
            PDF template.
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 min-w-[240px] flex-1">
            <Label htmlFor="project-report-template">Upload Project Report Template (PDF)</Label>
            <Input
              id="project-report-template"
              ref={templateInputRef}
              type="file"
              accept="application/pdf,.pdf"
              disabled={uploadingTemplate}
              className="hidden"
              onChange={(e) => void handleTemplateUpload(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            type="button"
            disabled={uploadingTemplate}
            onClick={() => templateInputRef.current?.click()}
          >
            {uploadingTemplate ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <UploadCloud className="size-4 mr-2" />
            )}
            {settings?.template_pdf_url ? "Replace Template" : "Upload Template"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 border-none shadow-elegant space-y-5">
        <h3 className="text-lg font-bold">Generate Report</h3>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Select University</Label>
            <Select value={universityId} onValueChange={setUniversityId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose university" />
              </SelectTrigger>
              <SelectContent>
                {unis.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Select Domain</Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger>
                <SelectValue placeholder="Choose domain" />
              </SelectTrigger>
              <SelectContent>
                {domainOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Select Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ProjectReportMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_REPORT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedUniversity ? (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/15 p-4">
            <div className="size-16 shrink-0 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain p-1" />
              ) : (
                <span className="text-[10px] text-muted-foreground text-center px-1">No logo</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">University</p>
              <p className="text-base font-bold">{selectedUniversity.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Logo {logoSrc ? "loaded automatically" : "not available for this university"}
              </p>
            </div>
            {domain ? (
              <Badge variant="outline" className="ml-auto">
                {domain} · {mode}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            onClick={() => void runGenerate("preview")}
            disabled={!canGenerate || generating}
          >
            {generating ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Eye className="size-4 mr-2" />
            )}
            Generate &amp; Preview
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void runGenerate("download")}
            disabled={!canGenerate || generating}
          >
            <Download className="size-4 mr-2" />
            Download PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runGenerate("preview")}
            disabled={!canGenerate || generating}
          >
            <RefreshCw className="size-4 mr-2" />
            Regenerate
          </Button>
        </div>
      </Card>

      {/* Hidden HTML document for fallback PDF generation */}
      <div className="sr-only" aria-hidden="true">
        {generateInput ? (
          <ProjectReportPreviewDocument ref={previewRef} {...generateInput} />
        ) : (
          <ProjectReportPreviewDocument
            ref={previewRef}
            universityName="Sample University"
            domain="Web Development"
            mode="Online"
          />
        )}
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) revokePreviewUrl();
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Project Report Preview</DialogTitle>
            <DialogDescription>
              {selectedUniversity?.name || "University"} · {domain || "Domain"} · {mode}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded-lg border bg-muted/20 overflow-hidden">
            {previewUrl ? (
              <iframe title="Project report preview" src={previewUrl} className="w-full h-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Generate a report to preview.
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void runGenerate("download")}
              disabled={!canGenerate || generating}
            >
              <Download className="size-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
