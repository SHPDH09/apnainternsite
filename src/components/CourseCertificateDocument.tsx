import { forwardRef } from "react";
import { DocumentBrandLogo } from "@/components/brand/DocumentBrandLogo";
import {
  CERTIFICATE_CEO,
  CERTIFICATE_CEO_TITLE,
  CERTIFICATE_COMPANY,
  certificateVerifyUrl,
} from "@/lib/certificateFormat";

export type CourseCertificateDisplayData = {
  studentName: string;
  courseTitle: string;
  certificateCode: string;
  issuedAtLabel: string;
  instructorName?: string | null;
  durationText?: string | null;
};

type Props = {
  data: CourseCertificateDisplayData;
  className?: string;
};

const pageStyle: React.CSSProperties = {
  width: "297mm",
  maxWidth: "297mm",
  minWidth: "297mm",
  height: "210mm",
  minHeight: "210mm",
  maxHeight: "210mm",
  boxSizing: "border-box",
};

export const CourseCertificateDocument = forwardRef<HTMLDivElement, Props>(
  function CourseCertificateDocument({ data, className }, ref) {
    const verifyUrl = certificateVerifyUrl(data.certificateCode);

    return (
      <div
        ref={ref}
        className={className}
        data-certificate-orientation="landscape"
        style={{
          ...pageStyle,
          background: "#fff",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#0f172a",
        }}
      >
        <div
          data-certificate-page
          style={{
            ...pageStyle,
            padding: "14mm 18mm",
            border: "6px double #5AA3E6",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <DocumentBrandLogo className="h-12 w-auto mb-4" />
          <p className="text-sm tracking-[0.35em] uppercase text-slate-500 font-semibold mb-2">
            {CERTIFICATE_COMPANY}
          </p>
          <h1 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">Certificate of Completion</h1>
          <p className="text-lg text-slate-600 mb-2">This is to certify that</p>
          <p className="text-3xl font-bold text-primary mb-6 border-b-2 border-slate-200 pb-2 px-8 min-w-[60%]">
            {data.studentName}
          </p>
          <p className="text-lg text-slate-600 mb-2">has successfully completed the course</p>
          <p className="text-2xl font-bold text-slate-900 mb-6 max-w-[85%]">{data.courseTitle}</p>
          {(data.instructorName || data.durationText) && (
            <p className="text-sm text-slate-500 mb-6">
              {[data.instructorName ? `Instructor: ${data.instructorName}` : null, data.durationText]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div className="mt-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-6 border-t border-slate-200">
            <div className="text-left">
              <p className="font-semibold text-slate-700">Certificate ID</p>
              <p className="font-mono text-slate-900">{data.certificateCode}</p>
              <p className="mt-2">Issued on {data.issuedAtLabel}</p>
            </div>
            <div className="text-center">
              <div className="h-10 border-b border-slate-400 w-40 mx-auto mb-1" />
              <p className="font-bold text-slate-800">{CERTIFICATE_CEO}</p>
              <p className="text-[10px] uppercase tracking-wider">{CERTIFICATE_CEO_TITLE}</p>
            </div>
            <div className="text-right max-w-[140px]">
              <p className="font-semibold text-slate-700">Verify online</p>
              <p className="break-all text-[10px]">{verifyUrl}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CourseCertificateDocument.displayName = "CourseCertificateDocument";
