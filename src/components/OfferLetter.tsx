import { forwardRef } from "react";
import { DocumentBrandLogo } from "@/components/brand/DocumentBrandLogo";
import {
  resolveOfferLetterFields,
} from "@/lib/offerLetterProfile";
import { getCachedDocumentTemplates } from "@/lib/documentTemplates";
import {
  OFFER_LETTER_CAPTURE_WIDTH_PX,
  OFFER_LETTER_PADDING_PX,
} from "@/lib/offerLetterPdf";
import { ACCREDITATION_LOGOS } from "@/lib/documentLogos";
import {
  CERTIFICATE_CEO,
  CERTIFICATE_CEO_TITLE,
  CERTIFICATE_COMPANY,
  CERTIFICATE_SIGNATURE_SRC,
} from "@/lib/certificateFormat";

interface OfferLetterProps {
  profile: any;
}

const letterStyle: React.CSSProperties = {
  width: OFFER_LETTER_CAPTURE_WIDTH_PX,
  maxWidth: OFFER_LETTER_CAPTURE_WIDTH_PX,
  minWidth: OFFER_LETTER_CAPTURE_WIDTH_PX,
  boxSizing: "border-box",
  overflow: "visible",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
};

export const OfferLetter = forwardRef<HTMLDivElement, OfferLetterProps>(({ profile }, ref) => {
  const fields = resolveOfferLetterFields(profile);
  const pad = OFFER_LETTER_PADDING_PX;
  const tpl = getCachedDocumentTemplates().offer_letter;
  const certTpl = getCachedDocumentTemplates().certificate;
  const ceoName = certTpl.ceoName?.trim() || CERTIFICATE_CEO;
  const ceoTitle = certTpl.ceoTitle?.trim() || CERTIFICATE_CEO_TITLE;
  const companyName = certTpl.companyName?.trim() || CERTIFICATE_COMPANY;
  const signatureSrc = certTpl.signatureSrc?.trim() || CERTIFICATE_SIGNATURE_SRC;
  const stampSrc = certTpl.stampSrc?.trim() || "/certificate/stamp.png";

  const topDateLabel = fields.isLnmu ? "Application Date" : "Date";
  const topDateValue = fields.issueDate;

  const rows: { l: string; v: string }[] = [
    { l: "Name of the Student", v: fields.fullName },
    { l: "Registration No.", v: fields.registrationNo },
    ...(fields.isBnmu
      ? [{ l: "University Roll No.", v: fields.universityRollNo }]
      : []),
    { l: "College / Institution", v: fields.collegeName },
    { l: "Department & Semester", v: fields.departmentSemester },
    { l: "Internship Domain", v: fields.internshipDomain },
    { l: "Internship Duration", v: fields.internshipDuration },
    { l: "Mode of Internship", v: fields.internshipMode },
    { l: "Internship Start Date", v: fields.startDate },
    {
      l: fields.isLnmu ? "Internship End Date" : "Expected End Date",
      v: fields.endDate,
    },
    { l: "Stipend", v: fields.stipend },
  ];

  return (
    <div
      ref={ref}
      data-offer-letter-root
      className="bg-white text-slate-800 text-[14px] leading-snug relative"
      style={letterStyle}
    >
      {/* Header — full width, no negative margins (PDF-safe) */}
      <div className="relative z-10 bg-white w-full">
        <div className="h-3 w-full bg-sky-500" />

        <div
          className="flex items-start justify-between gap-3 py-4"
          style={{ paddingLeft: pad, paddingRight: pad }}
        >
          <div className="flex items-center min-w-0 shrink">
            <DocumentBrandLogo heightMm={16} />
          </div>

          <div className="text-right text-[10px] leading-[1.4] text-slate-700 shrink-0 max-w-[240px]">
            <p>{tpl.addressLine1 || "Arfabad Colony, East Nahar Road, Bajranngpuri,"}</p>
            <p>{tpl.addressLine2 || "Patna - 800007"}</p>
            <p className="font-semibold">{tpl.phone || "7050936593"}</p>
            <p>{tpl.email || "contact@ezyintern.in"}</p>
            <p>{tpl.website || "www.ezyintern.in"}</p>
          </div>
        </div>

        <div className="border-t-2 border-sky-600" style={{ marginLeft: pad, marginRight: pad }} />

        <h1
          className="text-center py-3 text-[17px] font-bold tracking-wide text-slate-900"
          style={{ paddingLeft: pad, paddingRight: pad }}
        >
          {fields.isLnmu
            ? tpl.titleLnmu || "Internship Acceptance Letters"
            : tpl.title || "INTERNSHIP OFFER LETTER"}
        </h1>
      </div>

      <div
        className="relative z-10"
        style={{ paddingLeft: pad, paddingRight: pad, paddingBottom: pad }}
      >
        <div className="flex justify-between gap-3 text-[12px] font-bold mb-4 tabular-nums">
          <p className="min-w-0 break-words" style={{ maxWidth: "58%" }}>
            Letter Ref. No.:{" "}
            <span className="font-black text-slate-900">{fields.letterRefNo}</span>
          </p>
          <p className="shrink-0 text-right">
            {topDateLabel}: <span className="font-bold text-slate-900">{topDateValue}</span>
          </p>
        </div>

        <div className="text-[14px] space-y-1 mb-4">
          <p>To,</p>
          <p className="font-bold text-slate-900 uppercase break-words">{fields.fullName}</p>
          <p className="break-words">
            Registration No.: <span className="font-bold">{fields.registrationNo}</span>
          </p>
          <p className="break-words leading-snug">
            College / Institution:{" "}
            <span className="font-bold">{fields.collegeName}</span>
          </p>
        </div>

        <div className="text-[14px] space-y-3 leading-relaxed text-justify">
          <p className="font-bold">{tpl.greeting || "Dear Candidate,"}</p>
          <p>{tpl.introParagraph || "We are pleased to accept your application and formally offer you an internship at Apna Intern."}</p>

          <div className="rounded-lg border border-sky-200 bg-sky-50 py-3 px-3">
            <p className="font-bold mb-2">{tpl.detailsHeading || "Your internship details are as follows:"}</p>
            <table className="w-full border-collapse text-[13px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "44%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "52%" }} />
              </colgroup>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="align-top py-1 pr-1 text-slate-800 break-words">• {row.l}</td>
                    <td className="align-top py-1 text-center">:</td>
                    <td className="align-top py-1 font-bold text-slate-900 break-words">{row.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p>{tpl.closingParagraph1 || "Please report to us on your start date as per the schedule above."}</p>

          <p>{tpl.closingParagraph2 || `We look forward to a meaningful internship experience with ${companyName}.`}</p>
        </div>

        <div className="relative z-10 mt-6 w-full border-t border-slate-200 pt-4">
          <div className="flex justify-end items-end gap-2 mb-2">
            <img
              src={signatureSrc}
              alt={`Signature of ${ceoName}`}
              className="h-[48px] w-auto max-w-[170px] object-contain"
              crossOrigin="anonymous"
            />
            <img
              src={stampSrc}
              alt="Company stamp"
              className="h-[48px] w-[48px] object-contain shrink-0"
              crossOrigin="anonymous"
            />
          </div>
          <div className="text-right mb-3">
            <p className="text-[11px] font-bold text-slate-900">{ceoName}</p>
            <p className="text-[10px] font-semibold text-slate-700">{ceoTitle}</p>
            <p className="text-[9px] font-bold text-sky-600 uppercase tracking-wide leading-tight">
              {companyName}
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-2.5 py-1.5">
            {ACCREDITATION_LOGOS.map(({ src, alt, h }) => (
              <img
                key={src}
                src={src}
                alt={alt}
                className={`${h} w-auto object-contain`}
                crossOrigin="anonymous"
              />
            ))}
          </div>
          <p className="text-[9px] text-center font-semibold text-slate-600 pb-1">
            A DPIIT Recognised Startup India and ISO Certified Platform
          </p>
        </div>
      </div>
    </div>
  );
});

OfferLetter.displayName = "OfferLetter";
