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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  fetchProjectReportDomainTemplate,
  fetchProjectReportDomainTemplates,
  formatProjectReportUploadError,
  saveProjectReportDomainTemplate,
  validateProjectReportPdfFile,
  type ProjectReportDomainTemplate,
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

  const [domainTemplates, setDomainTemplates] = useState<ProjectReportDomainTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [uploadDomain, setUploadDomain] = useState("");
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  const [universityId, setUniversityId] = useState("");
  const [generateDomain, setGenerateDomain] = useState("");
  const [mode, setMode] = useState<ProjectReportMode>("Online");
  const [generating, setGenerating] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const domainOptions = useMemo(() => {
    const names = new Set<string>();
    for (const d of domains) {
      const n = String(d.name || "").trim();
      if (n) names.add(n);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [domains]);

  const templateByDomain = useMemo(() => {
    const map = new Map<string, ProjectReportDomainTemplate>();
    for (const row of domainTemplates) {
      map.set(row.domain_name.toLowerCase(), row);
      map.set(row.domain_key, row);
    }
    return map;
  }, [domainTemplates]);

  const selectedUniversity = useMemo(
    () => unis.find((u) => u.id === universityId) || null,
    [unis, universityId]
  );

  const selectedDomainTemplate = useMemo(() => {
    const key = generateDomain.trim().toLowerCase();
    if (!key) return null;
    return templateByDomain.get(key) || null;
  }, [generateDomain, templateByDomain]);

  const generateInput = useMemo<ProjectReportGenerateInput | null>(() => {
    if (!selectedUniversity || !generateDomain.trim()) return null;
    return {
      universityName: selectedUniversity.name,
      universityLogoUrl: selectedUniversity.logo_url,
      domain: generateDomain.trim(),
      mode,
    };
  }, [selectedUniversity, generateDomain, mode]);

  const canGenerate = !!generateInput && !!selectedDomainTemplate?.template_pdf_url;

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const rows = await fetchProjectReportDomainTemplates(supabase);
      setDomainTemplates(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load domain templates.";
      toast.error(msg);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) void loadTemplates();
  }, [isActive, loadTemplates]);

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
    if (!uploadDomain.trim()) {
      toast.error("Select a domain before uploading the project template.");
      return;
    }
    setUploadingTemplate(true);
    try {
      await validateProjectReportPdfFile(file);
      const saved = await saveProjectReportDomainTemplate(supabase, {
        domain: uploadDomain,
        file,
        uploadedBy: currentUserId,
      });
      setDomainTemplates((prev) => {
        const next = prev.filter((r) => r.domain_key !== saved.domain_key);
        return [...next, saved].sort((a, b) => a.domain_name.localeCompare(b.domain_name));
      });
      toast.success("Project report template uploaded successfully.");
    } catch (err) {
      toast.error(formatProjectReportUploadError(err));
    } finally {
      setUploadingTemplate(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  };

  const resolveTemplateForGenerate = async (): Promise<ProjectReportDomainTemplate | null> => {
    if (selectedDomainTemplate) return selectedDomainTemplate;
    if (!generateDomain.trim()) return null;
    return fetchProjectReportDomainTemplate(supabase, generateDomain);
  };

  const runGenerate = async (action: "preview" | "download") => {
    if (!generateInput) {
      toast.error("Select university and domain first.");
      return;
    }

    setGenerating(true);
    try {
      const template = await resolveTemplateForGenerate();
      if (!template?.template_pdf_url) {
        toast.error(`Upload a project report template for "${generateDomain}" first.`);
        return;
      }

      const htmlEl = previewRef.current;
      if (action === "preview") {
        revokePreviewUrl();
        const url = await previewProjectReportPdfUrl(template, generateInput, htmlEl);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPreviewOpen(true);
        toast.success("Report generated with selected university and domain template.");
      } else {
        await downloadProjectReportPdf(template, generateInput, htmlEl);
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
          Step 1: upload a project report PDF <strong>domain-wise</strong>. Step 2: select a
          university and generate — the chosen domain&apos;s project template is used with that
          university&apos;s name, logo, and selected mode.
        </p>
      </div>

      <Card className="p-6 border-none shadow-elegant space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="outline" className="mb-2">
              Step 1
            </Badge>
            <h3 className="text-lg font-bold">Domain-wise Project Template Upload</h3>
            <p className="text-sm text-muted-foreground">
              Each domain gets its own project report PDF (Web Development, Data Science, etc.).
              Upload once per domain; replace anytime.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadTemplates()}
            disabled={loadingTemplates}
          >
            <RefreshCw className={`size-4 mr-1.5 ${loadingTemplates ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 items-end">
          <div className="space-y-1.5">
            <Label>Select Domain for Upload</Label>
            <Select value={uploadDomain} onValueChange={setUploadDomain}>
              <SelectTrigger>
                <SelectValue placeholder="Choose domain" />
              </SelectTrigger>
              <SelectContent>
                {domainOptions.map((name) => (
                  <SelectItem key={`upload-${name}`} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              ref={templateInputRef}
              type="file"
              accept="application/pdf,.pdf"
              disabled={uploadingTemplate || !uploadDomain}
              className="hidden"
              onChange={(e) => void handleTemplateUpload(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              disabled={uploadingTemplate || !uploadDomain}
              onClick={() => templateInputRef.current?.click()}
            >
              {uploadingTemplate ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <UploadCloud className="size-4 mr-2" />
              )}
              {uploadDomain && templateByDomain.has(uploadDomain.toLowerCase())
                ? "Replace Domain Template"
                : "Upload Domain Template"}
            </Button>
          </div>
        </div>

        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading domain templates…
          </div>
        ) : domainTemplates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50/50 p-4 text-sm text-amber-900">
            No domain templates uploaded yet. Select a domain above and upload its project report
            PDF.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Template File</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domainTemplates.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.domain_name}</TableCell>
                    <TableCell>{row.template_file_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleString("en-IN")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.template_pdf_url ? (
                        <Button type="button" variant="ghost" size="sm" asChild>
                          <a href={row.template_pdf_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4 mr-1" />
                            View
                          </a>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-6 border-none shadow-elegant space-y-5">
        <div>
          <Badge variant="outline" className="mb-2">
            Step 2
          </Badge>
          <h3 className="text-lg font-bold">University-wise Report Generate</h3>
          <p className="text-sm text-muted-foreground">
            Pick university + domain + mode. The report uses the uploaded template for that domain,
            with the selected university name, logo, and mode applied automatically.
          </p>
        </div>

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
            <Select value={generateDomain} onValueChange={setGenerateDomain}>
              <SelectTrigger>
                <SelectValue placeholder="Choose domain" />
              </SelectTrigger>
              <SelectContent>
                {domainOptions.map((name) => {
                  const hasTemplate = templateByDomain.has(name.toLowerCase());
                  return (
                    <SelectItem key={`gen-${name}`} value={name}>
                      {name}
                      {hasTemplate ? "" : " (no template)"}
                    </SelectItem>
                  );
                })}
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
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">University</p>
              <p className="text-base font-bold">{selectedUniversity.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Logo {logoSrc ? "loaded automatically" : "not available"}
              </p>
            </div>
            {generateDomain ? (
              <div className="text-right">
                <Badge variant={selectedDomainTemplate ? "secondary" : "destructive"}>
                  {generateDomain} · {mode}
                </Badge>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {selectedDomainTemplate
                    ? "Domain template ready"
                    : "Upload template for this domain in Step 1"}
                </p>
              </div>
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
              {selectedUniversity?.name || "University"} · {generateDomain || "Domain"} · {mode}
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
