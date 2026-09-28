import { useEffect, useRef, useState } from "react";
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
  saveBlogDeviceReaderUnlock,
  submitBlogReaderLead,
} from "@/lib/siteBlogEngagement";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: SupabaseClient;
  postId: string;
  postTitle: string;
  /** When true, user must submit — no dismiss without filling the form. */
  requireSubmit?: boolean;
  onSubmitted: () => void;
};

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
  const [error, setError] = useState("");
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    const saved = getBlogDeviceReaderProfile();
    if (saved) {
      setFullName(saved.full_name || "");
      setEmail(saved.email || "");
      setPhone(saved.phone || "");
      setCollegeName(saved.college_name || "");
      return;
    }
    void (async () => {
      const fromStudent = await loadStudentBlogAutofill(client);
      if (fromStudent.full_name) setFullName(fromStudent.full_name);
      if (fromStudent.email) setEmail(fromStudent.email);
      if (fromStudent.college_name) setCollegeName(fromStudent.college_name);
    })();
  }, [open, client, postId]);

  useEffect(() => {
    if (!open) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => {
      void (async () => {
        const profile = await lookupBlogLeadAutofillByPhone(digits);
        if (profile.full_name && !fullName.trim()) setFullName(profile.full_name);
        if (profile.email && !email.trim()) setEmail(profile.email);
        if (profile.college_name && !collegeName.trim()) setCollegeName(profile.college_name);
      })();
    }, 450);
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [phone, open, fullName, email, collegeName]);

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
        if (!next && requireSubmit) return;
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
            Share your details to unlock <span className="font-medium text-slate-800">{postTitle}</span>.
            We pre-fill from your phone when we find your profile — just verify and submit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-phone">Mobile number</Label>
            <Input
              id="blog-lead-phone"
              inputMode="tel"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-name">Full name</Label>
            <Input
              id="blog-lead-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-email">Email</Label>
            <Input
              id="blog-lead-email"
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
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {!requireSubmit ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Later
            </Button>
          ) : null}
          <Button type="button" className="bg-[#5AA3E6] hover:bg-[#4a92d5]" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Submit & read"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
