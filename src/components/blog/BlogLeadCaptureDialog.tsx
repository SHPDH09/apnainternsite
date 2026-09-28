import { useEffect, useRef, useState } from "react";
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
  getOrCreateBlogDeviceId,
  saveBlogDeviceReaderUnlock,
  submitBlogReaderLead,
} from "@/lib/siteBlogEngagement";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
  /** When true, overlay/Escape cannot dismiss — Submit and Close buttons still work. */
  requireSubmit?: boolean;
  onSubmitted: () => void;
};

export function BlogLeadCaptureDialog({
  open,
  onOpenChange,
  postId,
  postTitle,
  requireSubmit = true,
  onSubmitted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const allowDismissRef = useRef(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setFormKey((k) => k + 1);
    requestAnimationFrame(() => {
      phoneInputRef.current?.focus();
    });
  }, [open, postId]);

  const handleClose = () => {
    allowDismissRef.current = true;
    onOpenChange(false);
  };

  const handleSubmit = async (form: HTMLFormElement) => {
    setError("");
    const fd = new FormData(form);
    const fullName = String(fd.get("full_name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const collegeName = String(fd.get("college_name") || "").trim();

    if (
      !fullName ||
      !email ||
      phone.replace(/\D/g, "").length < 10 ||
      !collegeName
    ) {
      setError("Please enter your name, email, 10-digit mobile, and college name (use Chrome autofill if saved).");
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
            Use Chrome saved details (tap a field for autofill suggestions). We only save to our database when
            you press Submit — nothing is loaded from the server into this form.
            Unlock <span className="font-medium text-slate-800">{postTitle}</span>.
          </DialogDescription>
        </DialogHeader>
        <form
          key={formKey}
          className="grid gap-3 py-1"
          autoComplete="on"
          id="apna-blog-lead-form"
          name="apna-blog-lead-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(e.currentTarget);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-phone">Mobile number</Label>
            <Input
              ref={phoneInputRef}
              id="blog-lead-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="10-digit mobile"
              defaultValue=""
              autoComplete="tel-national"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-name">Full name</Label>
            <Input
              id="blog-lead-name"
              name="full_name"
              defaultValue=""
              autoComplete="name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-email">Email</Label>
            <Input
              id="blog-lead-email"
              name="email"
              type="email"
              defaultValue=""
              autoComplete="email"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-lead-college">College name</Label>
            <Input
              id="blog-lead-college"
              name="college_name"
              defaultValue=""
              autoComplete="organization"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0 sm:justify-end">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Close
            </Button>
            <Button type="submit" className="bg-[#5AA3E6] hover:bg-[#4a92d5]" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Submit & read"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
