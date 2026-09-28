import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  collectBlogDeviceInfo,
  getBlogDeviceReaderProfile,
  getOrCreateBlogDeviceId,
  loadStudentBlogAutofill,
  lookupBlogLeadAutofillByPhone,
  mergeBlogLeadAutofill,
  saveBlogDeviceReaderUnlock,
  submitBlogReaderLead,
  type BlogLeadAutofillProfile,
} from "@/lib/siteBlogEngagement";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: SupabaseClient;
  postId: string;
  postTitle: string;
  /** When true, overlay/Escape cannot dismiss — Submit and Close buttons still work. */
  requireSubmit?: boolean;
  onSubmitted: () => void;
};

function applyProfile(
  setters: {
    setFullName: (v: string) => void;
    setEmail: (v: string) => void;
    setPhone: (v: string) => void;
    setCollegeName: (v: string) => void;
  },
  profile: BlogLeadAutofillProfile
) {
  if (profile.full_name) setters.setFullName(profile.full_name);
  if (profile.email) setters.setEmail(profile.email);
  if (profile.phone) setters.setPhone(profile.phone);
  if (profile.college_name) setters.setCollegeName(profile.college_name);
}

export function BlogLeadCaptureDialog({
  open,
  onOpenChange,
  client,
  postId,
  postTitle,
  requireSubmit = true,
  onSubmitted,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autofillReady, setAutofillReady] = useState(false);
  const [error, setError] = useState("");
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowDismissRef = useRef(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const setters = { setFullName, setEmail, setPhone, setCollegeName };

  const hydrateAutofill = useCallback(async () => {
    setError("");
    setAutofillReady(false);

    let merged: BlogLeadAutofillProfile = {
      full_name: "",
      email: "",
      college_name: "",
      phone: "",
    };

    const saved = getBlogDeviceReaderProfile();
    if (saved) {
      merged = mergeBlogLeadAutofill(merged, {
        full_name: saved.full_name,
        email: saved.email,
        college_name: saved.college_name,
        phone: saved.phone,
      });
      applyProfile(setters, merged);
      setAutofillReady(true);
      return;
    }

    const fromStudent = await loadStudentBlogAutofill(client);
    merged = mergeBlogLeadAutofill(merged, fromStudent);
    applyProfile(setters, merged);

    const digits = (merged.phone || "").replace(/\D/g, "").slice(-10);
    if (digits.length >= 10) {
      const fromPhone = await lookupBlogLeadAutofillByPhone(digits);
      merged = mergeBlogLeadAutofill(merged, { ...fromPhone, phone: digits });
      applyProfile(setters, merged);
    }

    setAutofillReady(true);
    requestAnimationFrame(() => {
      phoneInputRef.current?.focus();
    });
  }, [client]);

  useEffect(() => {
    if (!open) return;
    void hydrateAutofill();
  }, [open, postId, hydrateAutofill]);

  useEffect(() => {
    if (!open || !autofillReady) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => {
      void (async () => {
        const profile = await lookupBlogLeadAutofillByPhone(digits);
        setFullName((prev) => prev.trim() || profile.full_name);
        setEmail((prev) => prev.trim() || profile.email);
        setCollegeName((prev) => prev.trim() || profile.college_name);
      })();
    }, 350);
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [phone, open, autofillReady]);

  const handleClose = () => {
    allowDismissRef.current = true;
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (
      !fullName.trim() ||
      !email.trim() ||
      phone.replace(/\D/g, "").length < 10 ||
      !collegeName.trim()
    ) {
      setError("Please enter your name, email, 10-digit mobile, and college name.");
      return;
    }
    setSubmitting(true);
    try {
      const deviceId = getOrCreateBlogDeviceId();
      const deviceInfo = collectBlogDeviceInfo();
      await submitBlogReaderLead({
        postId,
        fullName,
        email,
        phone,
        collegeName,
        deviceId,
        deviceInfo,
      });
      saveBlogDeviceReaderUnlock({
        postId,
        fullName,
        email,
        phone,
        collegeName,
      });
      allowDismissRef.current = true;
      onSubmitted();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit. Please try again.";
      setError(msg.trim() || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && requireSubmit && !allowDismissRef.current) return;
        allowDismissRef.current = false;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (requireSubmit) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (requireSubmit) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Continue reading</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            We auto-fill from your saved profile or browser when possible — check the fields and tap Submit.
            Unlock <span className="font-medium text-slate-800">{postTitle}</span>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 py-1"
          autoComplete="on"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-phone">Mobile number</Label>
            <Input
              ref={phoneInputRef}
              id="blog-lead-phone"
              name="tel"
              inputMode="tel"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel-national"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-name">Full name</Label>
            <Input
              id="blog-lead-name"
              name="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-email">Email</Label>
            <Input
              id="blog-lead-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-college">College name</Label>
            <Input
              id="blog-lead-college"
              name="organization"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          {!autofillReady ? (
            <p className="text-xs text-slate-500">Loading your saved details…</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              Close
            </Button>
            <Button
              type="submit"
              className="bg-[#5AA3E6] hover:bg-[#4a92d5]"
              disabled={submitting || !autofillReady}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Submit & read"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
