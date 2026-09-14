import { forwardRef } from "react";
import {
  DocumentPage,
  DocumentPages,
  DocumentTitle,
  InfoTable,
} from "@/components/student/StudentDocumentLayout";
import {
  resolveProjectReportDomainContent,
  type ProjectReportMode,
} from "@/lib/projectReportDomainContent";
import { resolveStorageUrl } from "@/lib/storageUrl";

export type ProjectReportPreviewProps = {
  universityName: string;
  universityLogoUrl?: string | null;
  domain: string;
  mode: ProjectReportMode;
  issueDate?: string;
};

export const ProjectReportPreviewDocument = forwardRef<HTMLDivElement, ProjectReportPreviewProps>(
  function ProjectReportPreviewDocument(
    { universityName, universityLogoUrl, domain, mode, issueDate },
    ref
  ) {
    const section = resolveProjectReportDomainContent(domain);
    const logoSrc = resolveStorageUrl(universityLogoUrl || "") || universityLogoUrl || "";
    const today =
      issueDate ||
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    const coverRows: [string, string][] = [
      ["University", universityName],
      ["Domain", domain],
      ["Project Title", section.projectTitle],
      ["Internship Mode", mode],
      ["Report Date", today],
    ];

    return (
      <DocumentPages ref={ref}>
        <DocumentPage documentLabel="Project Report" issueDate={today} pageLabel="Page 1 of 2">
          <div className="flex items-start gap-4 mb-4">
            {logoSrc ? (
              <div className="size-[72px] shrink-0 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center">
                <img
                  src={logoSrc}
                  alt={`${universityName} logo`}
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            ) : (
              <div className="size-[72px] shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[9px] text-slate-400 text-center px-1">
                University Logo
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Submitted To</p>
              <p className="text-[16px] font-black text-[#1E3A8A] leading-tight">{universityName}</p>
            </div>
          </div>

          <DocumentTitle
            title="Internship Project Report"
            subtitle={`${domain} · ${mode} Mode`}
          />

          <InfoTable rows={coverRows} />

          <div className="space-y-3 text-[10.5px] text-slate-800">
            <section>
              <h2 className="text-[11px] font-bold text-[#1E3A8A] mb-1">1. Introduction</h2>
              <p className="leading-relaxed">{section.introduction}</p>
            </section>
            <section>
              <h2 className="text-[11px] font-bold text-[#1E3A8A] mb-1">2. Objectives</h2>
              <ol className="list-decimal pl-4 space-y-0.5">
                {section.objectives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
            <section>
              <h2 className="text-[11px] font-bold text-[#1E3A8A] mb-1">3. Scope</h2>
              <p className="leading-relaxed">{section.scope}</p>
            </section>
          </div>
        </DocumentPage>

        <DocumentPage
          documentLabel="Project Report"
          variant="continuation"
          continuationHeader={{
            studentName: universityName,
            pageLabel: "Page 2 of 2",
          }}
          issueDate={today}
          pageLabel="Page 2 of 2"
        >
          <div className="space-y-3 text-[10.5px] text-slate-800">
            <section>
              <h2 className="text-[11px] font-bold text-[#1E3A8A] mb-1">4. Methodology</h2>
              <p className="leading-relaxed">{section.methodology}</p>
              <p className="mt-1">
                <span className="font-bold">Delivery Mode: </span>
                {mode}
              </p>
            </section>
            <section>
              <h2 className="text-[11px] font-bold text-[#1E3A8A] mb-1">5. Tools &amp; Technologies</h2>
              <p>{section.toolsTechnologies.join(", ")}</p>
            </section>
            <section>
              <h2 className="text-[11px] font-bold text-[#1E3A8A] mb-1">6. Expected Outcomes</h2>
              <ol className="list-decimal pl-4 space-y-0.5">
                {section.expectedOutcomes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
            <section>
              <h2 className="text-[11px] font-bold text-[#1E3A8A] mb-1">7. Conclusion</h2>
              <p className="leading-relaxed">{section.conclusion}</p>
            </section>
          </div>
        </DocumentPage>
      </DocumentPages>
    );
  }
);
