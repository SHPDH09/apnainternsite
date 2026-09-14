import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Award,
  FileText,
  Loader2,
  Save,
  Search,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { fetchAdminStudentDirectoryPage } from "@/lib/adminStudentDirectory";
import { certificateDataFromStudent } from "@/lib/certificateFormat";
import { resolveOfferLetterFields } from "@/lib/offerLetterProfile";
import { IssuedCertificateDocument } from "@/components/IssuedCertificateDocument";
import { OfferLetter } from "@/components/OfferLetter";
import { DocumentTemplatePreviewPane } from "@/components/admin/DocumentTemplatePreviewPane";
import { OFFER_LETTER_CAPTURE_WIDTH_PX } from "@/lib/offerLetterPdf";
import {
  DEFAULT_CERTIFICATE_TEMPLATE,
  DEFAULT_OFFER_LETTER_TEMPLATE,
  type CertificateTemplateConfig,
  type OfferLetterTemplateConfig,
  buildSampleCertificateDisplay,
  buildSampleOfferLetterProfile,
  fetchDocumentTemplates,
  normalizeDocumentTemplatesRow,
  previewCertificateVariant,
  saveDocumentTemplates,
  saveStudentDocumentOverrides,
  setCachedDocumentTemplates,
  studentCertificateFormFromSources,
  studentDocumentOverridesFromForms,
  studentOfferLetterFormFromSources,
  type StudentCertificateCustomizationForm,
  type StudentOfferLetterCustomizationForm,
} from "@/lib/documentTemplates";

type Props = {
  client: SupabaseClient;
  currentUserId: string | null;
  isActive?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 bg-slate-50 border-slate-200"
      />
    </div>
  );
}

function CertStudentFields({
  form,
  onChange,
}: {
  form: StudentCertificateCustomizationForm;
  onChange: (patch: Partial<StudentCertificateCustomizationForm>) => void;
}) {
  const set = (key: keyof StudentCertificateCustomizationForm) => (value: string) =>
    onChange({ [key]: value });

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Student name" value={form.studentName} onChange={set("studentName")} />
      <Field label="Parent / guardian name" value={form.parentName} onChange={set("parentName")} />
      <Field label="University roll no." value={form.universityRollNo} onChange={set("universityRollNo")} />
      <Field
        label="University registration no."
        value={form.universityRegistrationNumber}
        onChange={set("universityRegistrationNumber")}
      />
      <Field label="College name" value={form.collegeName} onChange={set("collegeName")} />
      <Field label="University name" value={form.universityName} onChange={set("universityName")} />
      <Field label="Academic session" value={form.academicSession} onChange={set("academicSession")} />
      <Field label="Degree / course" value={form.degree} onChange={set("degree")} />
      <Field label="Department / subject" value={form.subject} onChange={set("subject")} />
      <Field label="Internship domain" value={form.internshipDomain} onChange={set("internshipDomain")} />
      <Field label="Internship duration" value={form.internshipDuration} onChange={set("internshipDuration")} />
      <Field label="Internship mode" value={form.internshipMode} onChange={set("internshipMode")} />
      <Field label="Total hours" value={form.totalHours} onChange={set("totalHours")} />
      <Field label="Credits" value={form.creditsRecommended} onChange={set("creditsRecommended")} />
      <Field label="Marks %" value={form.marksPercent} onChange={set("marksPercent")} />
      <Field label="Semester" value={form.semester} onChange={set("semester")} />
      <Field label="Gender" value={form.gender} onChange={set("gender")} />
      <Field label="Start date (cert)" value={form.startDate} onChange={set("startDate")} />
      <Field label="End date (cert)" value={form.endDate} onChange={set("endDate")} />
      <Field label="Duration label" value={form.durationLabel} onChange={set("durationLabel")} />
    </div>
  );
}

function OfferStudentFields({
  form,
  onChange,
}: {
  form: StudentOfferLetterCustomizationForm;
  onChange: (patch: Partial<StudentOfferLetterCustomizationForm>) => void;
}) {
  const set = (key: keyof StudentOfferLetterCustomizationForm) => (value: string) =>
    onChange({ [key]: value });

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Issue date" value={form.issueDate} onChange={set("issueDate")} />
      <Field label="Letter ref. no." value={form.letterRefNo} onChange={set("letterRefNo")} />
      <Field label="Student name" value={form.fullName} onChange={set("fullName")} />
      <Field label="Registration no." value={form.registrationNo} onChange={set("registrationNo")} />
      <Field label="University roll no." value={form.universityRollNo} onChange={set("universityRollNo")} />
      <Field label="College / institution" value={form.collegeName} onChange={set("collegeName")} />
      <Field label="Department & semester" value={form.departmentSemester} onChange={set("departmentSemester")} />
      <Field label="Internship domain" value={form.internshipDomain} onChange={set("internshipDomain")} />
      <Field label="Internship duration" value={form.internshipDuration} onChange={set("internshipDuration")} />
      <Field label="Mode of internship" value={form.internshipMode} onChange={set("internshipMode")} />
      <Field label="Start date" value={form.startDate} onChange={set("startDate")} />
      <Field label="End date" value={form.endDate} onChange={set("endDate")} />
      <Field label="Stipend" value={form.stipend} onChange={set("stipend")} />
    </div>
  );
}

export function DocumentCustomizationPanel({ client, currentUserId, isActive = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [certificateTpl, setCertificateTpl] = useState<CertificateTemplateConfig>(
    DEFAULT_CERTIFICATE_TEMPLATE
  );
  const [offerTpl, setOfferTpl] = useState<OfferLetterTemplateConfig>(DEFAULT_OFFER_LETTER_TEMPLATE);

  const [studentSearch, setStudentSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Record<string, unknown> | null>(null);
  const [certStudentForm, setCertStudentForm] = useState<StudentCertificateCustomizationForm | null>(
    null
  );
  const [offerStudentForm, setOfferStudentForm] = useState<StudentOfferLetterCustomizationForm | null>(
    null
  );

  const reloadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const row = await fetchDocumentTemplates(client);
      setCertificateTpl(row.certificate);
      setOfferTpl(row.offer_letter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load document templates.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!isActive) return;
    void reloadTemplates();
  }, [isActive, reloadTemplates]);

  const runStudentSearch = async () => {
    const q = studentSearch.trim();
    if (q.length < 2) {
      toast.error("Enter at least 2 characters to search.");
      return;
    }
    setSearching(true);
    try {
      const { rows } = await fetchAdminStudentDirectoryPage(client, 0, 20, { searchTerm: q });
      setSearchResults(rows);
      if (!rows.length) toast.message("No students matched your search.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Student search failed.");
    } finally {
      setSearching(false);
    }
  };

  const selectStudent = async (row: Record<string, unknown>) => {
    setSelectedStudent(row);
    try {
      const { data, error } = await client
        .from("students")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      if (error) throw error;
      const student = (data as Record<string, unknown>) || row;
      setSelectedStudent(student);
      const certDisplay = certificateDataFromStudent(student, null, { useSavedProfileOverrides: true });
      const offerFields = resolveOfferLetterFields(student);
      setCertStudentForm(studentCertificateFormFromSources(certDisplay, student));
      setOfferStudentForm(studentOfferLetterFormFromSources(offerFields, student));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load student details.");
    }
  };

  const selectedLabel = useMemo(() => {
    if (!selectedStudent) return null;
    const name = String(selectedStudent.full_name || "Student");
    const reg = String(selectedStudent.registration_id || selectedStudent.roll_number || "").trim();
    const email = String(selectedStudent.email || "").trim();
    return { name, reg, email };
  }, [selectedStudent]);

  const previewTemplates = useMemo(
    () =>
      normalizeDocumentTemplatesRow({
        certificate: certificateTpl,
        offer_letter: offerTpl,
      }),
    [certificateTpl, offerTpl]
  );

  useLayoutEffect(() => {
    setCachedDocumentTemplates(previewTemplates);
  }, [previewTemplates]);

  const certificatePreviewVariant = previewCertificateVariant(certificateTpl);
  const certificatePreviewData = useMemo(
    () => buildSampleCertificateDisplay(certificateTpl, certificatePreviewVariant),
    [certificateTpl, certificatePreviewVariant]
  );
  const offerPreviewProfile = useMemo(() => buildSampleOfferLetterProfile(), []);

  const saveGlobalCertificate = async () => {
    setSavingGlobal(true);
    try {
      await saveDocumentTemplates(client, { certificate: certificateTpl }, currentUserId);
      toast.success("Certificate template updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingGlobal(false);
    }
  };

  const saveGlobalOffer = async () => {
    setSavingGlobal(true);
    try {
      await saveDocumentTemplates(client, { offer_letter: offerTpl }, currentUserId);
      toast.success("Offer letter template updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingGlobal(false);
    }
  };

  const saveStudentCustomization = async () => {
    if (!selectedStudent?.id || !certStudentForm || !offerStudentForm) return;
    setSavingStudent(true);
    try {
      const overrides = studentDocumentOverridesFromForms(certStudentForm, offerStudentForm);
      await saveStudentDocumentOverrides(client, String(selectedStudent.id), overrides);
      toast.success("Student certificate & offer letter customization saved.");
      await selectStudent({ ...selectedStudent, document_overrides: overrides });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save student customization.");
    } finally {
      setSavingStudent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 className="size-5 animate-spin" /> Loading customization settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <FileText className="size-5 text-primary" /> Document Customization
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Update global certificate and offer letter templates, or customize documents for an individual
          student after searching their profile.
        </p>
      </div>

      <Tabs defaultValue="certificate-template" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
          <TabsTrigger value="certificate-template" className="gap-1.5">
            <Award className="size-3.5" /> Certificate template
          </TabsTrigger>
          <TabsTrigger value="offer-template" className="gap-1.5">
            <FileText className="size-3.5" /> Offer letter template
          </TabsTrigger>
          <TabsTrigger value="student-custom" className="gap-1.5">
            <Users className="size-3.5" /> Student customization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="certificate-template">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,42%)] gap-6 items-start">
            <Card className="p-6 border-none shadow-elegant space-y-4">
              <p className="text-sm text-slate-600">
                Global defaults applied to all newly generated certificates. Per-student overrides are set
                under Student customization.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Default layout
                </Label>
                <Select
                  value={certificateTpl.defaultVariant || "auto"}
                  onValueChange={(v) =>
                    setCertificateTpl((prev) => ({
                      ...prev,
                      defaultVariant: v as CertificateTemplateConfig["defaultVariant"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (by university track)</SelectItem>
                    <SelectItem value="standard">Standard completion certificate</SelectItem>
                    <SelectItem value="engineering">Engineering industrial training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Internship period"
                value={certificateTpl.internshipPeriod || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, internshipPeriod: v }))}
              />
              <Field
                label="Total hours"
                value={certificateTpl.totalHours || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, totalHours: v }))}
              />
              <Field
                label="Credits"
                value={certificateTpl.credits || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, credits: v }))}
              />
              <Field
                label="Verify URL"
                value={certificateTpl.verifyUrl || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, verifyUrl: v }))}
              />
              <Field
                label="Company name"
                value={certificateTpl.companyName || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, companyName: v }))}
              />
              <Field
                label="CEO name"
                value={certificateTpl.ceoName || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, ceoName: v }))}
              />
              <Field
                label="CEO title"
                value={certificateTpl.ceoTitle || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, ceoTitle: v }))}
              />
              <Field
                label="Signature image URL"
                value={certificateTpl.signatureSrc || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, signatureSrc: v }))}
              />
              <Field
                label="Stamp image URL"
                value={certificateTpl.stampSrc || ""}
                onChange={(v) => setCertificateTpl((p) => ({ ...p, stampSrc: v }))}
              />
              </div>
              <Button
                className="font-black gap-2"
                disabled={savingGlobal}
                onClick={() => void saveGlobalCertificate()}
              >
                {savingGlobal ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save certificate template
              </Button>
            </Card>

            <DocumentTemplatePreviewPane
              title={
                certificatePreviewVariant === "engineering"
                  ? "Live preview — Engineering certificate"
                  : "Live preview — Standard certificate"
              }
              naturalWidth={certificatePreviewVariant === "engineering" ? "297mm" : "210mm"}
              naturalHeight={certificatePreviewVariant === "engineering" ? "210mm" : "297mm"}
              scale={certificatePreviewVariant === "engineering" ? 0.36 : 0.42}
            >
              <IssuedCertificateDocument data={certificatePreviewData} showSignature />
            </DocumentTemplatePreviewPane>
          </div>
        </TabsContent>

        <TabsContent value="offer-template">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,42%)] gap-6 items-start">
            <Card className="p-6 border-none shadow-elegant space-y-4">
              <p className="text-sm text-slate-600">
                Global offer letter copy and header details. Student-specific field values are customized
                separately.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="Title (default)"
                value={offerTpl.title || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, title: v }))}
              />
              <Field
                label="Title (LNMU)"
                value={offerTpl.titleLnmu || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, titleLnmu: v }))}
              />
              <Field
                label="Address line 1"
                value={offerTpl.addressLine1 || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, addressLine1: v }))}
              />
              <Field
                label="Address line 2"
                value={offerTpl.addressLine2 || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, addressLine2: v }))}
              />
              <Field
                label="Phone"
                value={offerTpl.phone || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, phone: v }))}
              />
              <Field
                label="Email"
                value={offerTpl.email || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, email: v }))}
              />
              <Field
                label="Website"
                value={offerTpl.website || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, website: v }))}
              />
              <Field
                label="Default issue date"
                value={offerTpl.defaultIssueDate || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, defaultIssueDate: v }))}
              />
              <Field
                label="Default stipend text"
                value={offerTpl.defaultStipend || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, defaultStipend: v }))}
              />
              <Field
                label="Greeting"
                value={offerTpl.greeting || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, greeting: v }))}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Intro paragraph
                </Label>
                <Textarea
                  value={offerTpl.introParagraph || ""}
                  onChange={(e) => setOfferTpl((p) => ({ ...p, introParagraph: e.target.value }))}
                  rows={3}
                  className="bg-slate-50"
                />
              </div>
              <Field
                label="Details table heading"
                value={offerTpl.detailsHeading || ""}
                onChange={(v) => setOfferTpl((p) => ({ ...p, detailsHeading: v }))}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Closing paragraph 1
                </Label>
                <Textarea
                  value={offerTpl.closingParagraph1 || ""}
                  onChange={(e) => setOfferTpl((p) => ({ ...p, closingParagraph1: e.target.value }))}
                  rows={3}
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Closing paragraph 2
                </Label>
                <Textarea
                  value={offerTpl.closingParagraph2 || ""}
                  onChange={(e) => setOfferTpl((p) => ({ ...p, closingParagraph2: e.target.value }))}
                  rows={2}
                  className="bg-slate-50"
                />
              </div>
              </div>
              <Button
                className="font-black gap-2"
                disabled={savingGlobal}
                onClick={() => void saveGlobalOffer()}
              >
                {savingGlobal ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save offer letter template
              </Button>
            </Card>

            <DocumentTemplatePreviewPane
              title="Live preview — Offer letter"
              naturalWidth={`${OFFER_LETTER_CAPTURE_WIDTH_PX}px`}
              naturalHeight="1120px"
              scale={0.46}
            >
              <OfferLetter profile={offerPreviewProfile} />
            </DocumentTemplatePreviewPane>
          </div>
        </TabsContent>

        <TabsContent value="student-custom">
          <Card className="p-6 border-none shadow-elegant space-y-5">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Search className="size-4 text-primary" /> Search or select student
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Search by name, email, registration ID, or roll number — then pick a student to customize
                their certificate and offer letter fields.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
              <Input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search student…"
                className="bg-slate-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runStudentSearch();
                }}
              />
              <Button
                type="button"
                className="font-black shrink-0 gap-2"
                disabled={searching}
                onClick={() => void runStudentSearch()}
              >
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Search
              </Button>
            </div>

            {searchResults.length > 0 ? (
              <ScrollArea className="max-h-48 rounded-xl border bg-slate-50">
                <div className="divide-y">
                  {searchResults.map((row) => {
                    const id = String(row.id);
                    const active = selectedStudent && String(selectedStudent.id) === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`w-full text-left px-4 py-3 hover:bg-white transition-colors ${
                          active ? "bg-primary/5 border-l-2 border-l-primary" : ""
                        }`}
                        onClick={() => void selectStudent(row)}
                      >
                        <p className="font-bold text-sm text-slate-900">{String(row.full_name || "—")}</p>
                        <p className="text-xs text-slate-500">
                          {String(row.registration_id || row.roll_number || "—")} ·{" "}
                          {String(row.email || "—")}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : null}

            {selectedLabel ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex flex-wrap items-center gap-2">
                <User className="size-4 text-primary" />
                <span className="font-bold text-slate-900">{selectedLabel.name}</span>
                {selectedLabel.reg ? (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {selectedLabel.reg}
                  </Badge>
                ) : null}
                {selectedLabel.email ? (
                  <span className="text-xs text-slate-600">{selectedLabel.email}</span>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Select a student to show customization fields.</p>
            )}

            {certStudentForm && offerStudentForm ? (
              <Tabs defaultValue="student-cert" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="student-cert">Certificate fields</TabsTrigger>
                  <TabsTrigger value="student-offer">Offer letter fields</TabsTrigger>
                </TabsList>
                <TabsContent value="student-cert">
                  <CertStudentFields
                    form={certStudentForm}
                    onChange={(patch) => setCertStudentForm((prev) => (prev ? { ...prev, ...patch } : prev))}
                  />
                </TabsContent>
                <TabsContent value="student-offer">
                  <OfferStudentFields
                    form={offerStudentForm}
                    onChange={(patch) => setOfferStudentForm((prev) => (prev ? { ...prev, ...patch } : prev))}
                  />
                </TabsContent>
                <Button
                  className="font-black gap-2"
                  disabled={savingStudent}
                  onClick={() => void saveStudentCustomization()}
                >
                  {savingStudent ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save student customization
                </Button>
              </Tabs>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
