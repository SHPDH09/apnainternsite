import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { PROJECT_REPORT_MODES, type ProjectReportMode } from "@/lib/projectReportDomainContent";
import { getStudentProjectReportMode } from "@/lib/studentProjectReport";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Record<string, unknown> | null | undefined;
  universityName?: string;
  domain?: string;
  uploading?: boolean;
  onUpload: (file: File, mode: ProjectReportMode) => Promise<void>;
};

export function ProjectReportUploadDialog({
  open,
  onOpenChange,
  profile,
  universityName,
  domain,
  uploading = false,
  onUpload,
}: Props) {
  const [mode, setMode] = useState<ProjectReportMode>("Hybrid");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setMode(getStudentProjectReportMode(profile));
      setFile(null);
    }
  }, [open, profile]);

  const handleSubmit = async () => {
    if (!file) return;
    await onUpload(file, mode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Project Report</DialogTitle>
          <DialogDescription>
            Pages 1–7 (cover, declaration, certificates, acknowledgement) will be added automatically
            with your university logo, domain, and selected programme mode. Your uploaded PDF follows
            from page 8.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 space-y-1">
            <p>
              <span className="font-medium text-slate-800">University:</span> {universityName || "—"}
            </p>
            <p>
              <span className="font-medium text-slate-800">Domain:</span> {domain || "—"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-report-mode">Internship Training Programme</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ProjectReportMode)}>
              <SelectTrigger id="project-report-mode">
                <SelectValue placeholder="Select programme mode" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_REPORT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m} Internship Training Programme
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              This appears on page 1 as ({mode} Internship Training Programme).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-report-file">Your project report (PDF)</Label>
            <input
              id="project-report-file"
              type="file"
              accept=".pdf,application/pdf"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-900"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-slate-500">PDF only, up to 25 MB. Abstract and chapters start from page 8.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" disabled={!file || uploading} onClick={() => void handleSubmit()}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Merging…
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                Upload &amp; merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
