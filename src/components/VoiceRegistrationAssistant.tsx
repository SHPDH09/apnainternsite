import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, X, Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeminiVoiceOrb } from "@/components/GeminiVoiceOrb";
import { useSpeechFieldCapture } from "@/lib/useSpeechFieldCapture";
import {
  formatIsoDateForDisplay,
  parseSpokenDate,
} from "@/lib/parseSpokenDate";
import { cn } from "@/lib/utils";

export type VoiceRegistrationField =
  | "fullName"
  | "parentName"
  | "gender"
  | "dob"
  | "contact"
  | "email";

const FIELD_META: Record<
  VoiceRegistrationField,
  { label: string; prompt: string; hint?: string }
> = {
  fullName: {
    label: "Full name",
    prompt: "Say your full name clearly.",
  },
  parentName: {
    label: "Parent / guardian name",
    prompt: "Say your parent or guardian name.",
  },
  gender: {
    label: "Gender",
    prompt: "Say Male or Female.",
  },
  dob: {
    label: "Date of birth",
    prompt: "Say your date of birth, for example 10 October 2005 or 5.5.2006.",
    hint: "We capture the full phrase — not just the first number.",
  },
  contact: {
    label: "Mobile number",
    prompt: "Say your 10-digit mobile number.",
  },
  email: {
    label: "Email",
    prompt: "Spell or say your email address.",
  },
};

export type VoiceRegistrationValues = Partial<Record<VoiceRegistrationField, string>>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields?: VoiceRegistrationField[];
  onConfirm: (values: VoiceRegistrationValues) => void;
};

function normalizeGender(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (/female|girl|woman|mahila|ladki/.test(t)) return "Female";
  if (/male|boy|man|ladka/.test(t)) return "Male";
  return raw.trim();
}

function normalizeContact(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function normalizeEmail(raw: string): string {
  return raw
    .trim()
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s+/g, "");
}

function parseFieldValue(field: VoiceRegistrationField, raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  if (field === "dob") {
    const iso = parseSpokenDate(text);
    return iso || text;
  }
  if (field === "gender") return normalizeGender(text);
  if (field === "contact") return normalizeContact(text);
  if (field === "email") return normalizeEmail(text);
  return text;
}

function displayValue(field: VoiceRegistrationField, value: string): string {
  if (field === "dob" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatIsoDateForDisplay(value);
  }
  return value;
}

export function VoiceRegistrationAssistant({
  open,
  onOpenChange,
  fields = ["fullName", "parentName", "gender", "dob", "contact", "email"],
  onConfirm,
}: Props) {
  const steps = useMemo(() => [...fields, "confirm"] as const, [fields]);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<VoiceRegistrationValues>({});
  const [fieldError, setFieldError] = useState<string | null>(null);

  const speech = useSpeechFieldCapture("en-IN");
  const current = steps[stepIndex];
  const isConfirm = current === "confirm";
  const fieldKey = !isConfirm ? (current as VoiceRegistrationField) : null;
  const meta = fieldKey ? FIELD_META[fieldKey] : null;

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setValues({});
      setFieldError(null);
      speech.stopListening();
      speech.resetTranscript();
    }
  }, [open, speech]);

  useEffect(() => {
    if (!open || isConfirm) return;
    speech.resetTranscript();
    setFieldError(null);
    const t = window.setTimeout(() => speech.startListening(), 400);
    return () => window.clearTimeout(t);
  }, [open, stepIndex, isConfirm, speech]);

  if (!open) return null;

  const close = () => onOpenChange(false);

  const commitField = () => {
    if (!fieldKey) return;
    speech.stopListening();
    const raw = speech.getCapturedText();
    if (!raw) {
      setFieldError("We did not hear anything. Tap the mic and try again.");
      return;
    }
    const parsed = parseFieldValue(fieldKey, raw);
    if (fieldKey === "dob" && !/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
      setFieldError(
        `Could not understand that date. Try "10 October 2005" or "5.5.2006". Heard: "${raw}"`
      );
      return;
    }
    if (fieldKey === "contact" && parsed.replace(/\D/g, "").length < 10) {
      setFieldError("Please say a complete 10-digit mobile number.");
      return;
    }
    setValues((prev) => ({ ...prev, [fieldKey]: parsed }));
    setStepIndex((i) => i + 1);
  };

  const confirmApply = () => {
    onConfirm(values);
    close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <p className="text-xs uppercase tracking-widest text-sky-300/90 font-semibold">
            Voice assistant
          </p>
          <p className="text-sm text-white/80">
            {isConfirm ? "Review & confirm" : `Step ${stepIndex + 1} of ${fields.length}`}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={close} className="text-white hover:bg-white/10">
          <X className="size-5" />
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-8 overflow-y-auto">
        <GeminiVoiceOrb active={speech.listening} className="mb-8" />

        {!isConfirm && meta && (
          <>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">{meta.label}</h2>
            <p className="text-center text-white/75 max-w-md mb-6">{meta.prompt}</p>
            {meta.hint && (
              <p className="text-center text-xs text-sky-200/80 max-w-md mb-4">{meta.hint}</p>
            )}
          </>
        )}

        {isConfirm && (
          <div className="w-full max-w-lg space-y-4">
            <h2 className="text-2xl font-bold text-center">Confirm your details</h2>
            <p className="text-center text-sm text-white/70 mb-2">
              Check everything below, then confirm to fill the registration form.
            </p>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3 text-sm">
              {fields.map((key) => (
                <div key={key} className="flex justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                  <span className="text-white/60">{FIELD_META[key].label}</span>
                  <span className="font-medium text-right">
                    {values[key] ? displayValue(key, values[key]!) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isConfirm && (
          <div className="w-full max-w-xl mt-2">
            <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2 text-center">
              Live transcript
            </p>
            <div
              className={cn(
                "min-h-[88px] rounded-2xl border px-4 py-3 text-lg leading-relaxed",
                speech.transcript ? "border-sky-400/40 bg-white/10" : "border-white/10 bg-black/20"
              )}
            >
              {speech.transcript || (
                <span className="text-white/40 text-base">
                  {speech.listening ? "Listening…" : "Tap the microphone to speak"}
                </span>
              )}
            </div>
            {fieldError && (
              <p className="mt-3 text-sm text-amber-300 text-center">{fieldError}</p>
            )}
          </div>
        )}
      </main>

      <footer className="px-4 pb-6 pt-2 flex flex-wrap items-center justify-center gap-3 border-t border-white/10">
        {!speech.supported && (
          <p className="w-full text-center text-amber-300 text-sm mb-2">
            Voice input is not supported in this browser. Use Chrome or Edge on desktop/Android.
          </p>
        )}

        {!isConfirm && (
          <>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                if (speech.listening) speech.stopListening();
                else speech.startListening();
              }}
              disabled={!speech.supported}
            >
              {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              {speech.listening ? "Stop" : "Mic"}
            </Button>
            <Button type="button" className="gap-2" onClick={commitField}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          </>
        )}

        {isConfirm && (
          <>
            <Button type="button" variant="secondary" onClick={() => setStepIndex(0)}>
              Start over
            </Button>
            <Button type="button" className="gap-2" onClick={confirmApply}>
              <Check className="size-4" />
              Confirm & fill form
            </Button>
          </>
        )}

        {speech.listening && (
          <span className="flex items-center gap-2 text-xs text-sky-200">
            <Loader2 className="size-3 animate-spin" /> Listening
          </span>
        )}
      </footer>
    </div>
  );
}
