import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createSitePopup,
  deleteSitePopup,
  fetchAdminSitePopups,
  updateSitePopup,
  uploadPopupImage,
  type SitePopupWrite,
} from "@/lib/sitePopupsApi";
import {
  datetimeLocalFromIso,
  isoFromDatetimeLocal,
  POPUP_PAGE_OPTIONS,
  type SitePopup,
  type SitePopupType,
} from "@/lib/sitePopups";

type Props = {
  client: SupabaseClient;
  currentUserId: string | null;
};

type FormState = {
  title: string;
  popup_type: SitePopupType;
  message: string;
  cta_label: string;
  cta_url: string;
  pages: string[];
  start_at: string;
  end_at: string;
  is_active: boolean;
  sort_order: number;
};

const emptyForm = (): FormState => ({
  title: "",
  popup_type: "text",
  message: "",
  cta_label: "",
  cta_url: "",
  pages: ["all"],
  start_at: "",
  end_at: "",
  is_active: true,
  sort_order: 0,
});

function formFromRow(row: SitePopup): FormState {
  return {
    title: row.title || "",
    popup_type: row.popup_type === "image" ? "image" : "text",
    message: row.message || "",
    cta_label: row.cta_label || "",
    cta_url: row.cta_url || "",
    pages: row.pages?.length ? row.pages : ["all"],
    start_at: datetimeLocalFromIso(row.start_at),
    end_at: datetimeLocalFromIso(row.end_at),
    is_active: row.is_active !== false,
    sort_order: row.sort_order ?? 0,
  };
}

function toWritePayload(
  form: FormState,
  image?: { image_url?: string | null; image_path?: string | null }
): SitePopupWrite {
  const pages = form.pages.includes("all") ? ["all"] : form.pages.filter((p) => p !== "all");
  return {
    title: form.title.trim() || "Untitled popup",
    popup_type: form.popup_type,
    message: form.popup_type === "text" ? form.message.trim() || null : form.message.trim() || null,
    cta_label: form.cta_label.trim() || null,
    cta_url: form.cta_url.trim() || null,
    pages: pages.length ? pages : ["all"],
    start_at: isoFromDatetimeLocal(form.start_at),
    end_at: isoFromDatetimeLocal(form.end_at),
    is_active: form.is_active,
    sort_order: Number(form.sort_order) || 0,
    ...(image || {}),
  };
}

function scheduleLabel(row: SitePopup): string {
  if (!row.start_at && !row.end_at) return "Always (while enabled)";
  const fmt = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };
  return `${fmt(row.start_at)} → ${fmt(row.end_at)}`;
}

function pagesLabel(pages: string[]): string {
  if (!pages?.length || pages.includes("all")) return "All pages";
  const labels = pages.map(
    (k) => POPUP_PAGE_OPTIONS.find((p) => p.key === k)?.label || k
  );
  return labels.join(", ");
}

export function PopupManagementPanel({ client, currentUserId }: Props) {
  const [rows, setRows] = useState<SitePopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SitePopup | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminSitePopups(client));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load popups.";
      if (/relation .*site_popups.* does not exist|Could not find the table/i.test(msg)) {
        toast.error("Run the site_popups SQL migration, then reload.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), sort_order: rows.length });
    setFile(null);
    setDialogOpen(true);
  };

  const openEdit = (row: SitePopup) => {
    setEditing(row);
    setForm(formFromRow(row));
    setFile(null);
    setDialogOpen(true);
  };

  const togglePage = (key: string) => {
    if (key === "all") {
      setForm((f) => ({ ...f, pages: f.pages.includes("all") ? [] : ["all"] }));
      return;
    }
    setForm((f) => {
      const withoutAll = f.pages.filter((p) => p !== "all");
      const next = withoutAll.includes(key)
        ? withoutAll.filter((p) => p !== key)
        : [...withoutAll, key];
      return { ...f, pages: next };
    });
  };

  const handleSave = async () => {
    if (form.popup_type === "image" && !file && !editing?.image_url) {
      toast.error("Upload an image for an image popup.");
      return;
    }
    if (form.popup_type === "text" && !form.message.trim()) {
      toast.error("Enter popup text.");
      return;
    }
    if (!form.pages.length) {
      toast.error("Select at least one page, or All Pages.");
      return;
    }
    setSaving(true);
    try {
      let image: { image_url?: string | null; image_path?: string | null } | undefined;
      if (form.popup_type === "image" && file) {
        if (!currentUserId) {
          toast.error("Sign in to upload images.");
          setSaving(false);
          return;
        }
        image = await uploadPopupImage(client, file, currentUserId);
      }
      const payload = toWritePayload(form, image);
      if (editing) {
        await updateSitePopup(client, editing.id, payload);
        toast.success("Popup updated.");
      } else {
        await createSitePopup(client, payload, currentUserId);
        toast.success("Popup created.");
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: SitePopup, is_active: boolean) => {
    try {
      await updateSitePopup(client, row.id, { is_active });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const handleDelete = async (row: SitePopup) => {
    if (!window.confirm(`Delete popup “${row.title || "Untitled"}”?`)) return;
    try {
      await deleteSitePopup(client, row);
      toast.success("Popup deleted.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const previewSrc = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return editing?.image_url || "";
  }, [file, editing]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Megaphone className="size-5 text-primary" /> Popup Management
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Create image or text popups, schedule start/end times, and choose which pages they appear on.
            Multiple popups can be active at once — visitors see them in sort order.
          </p>
        </div>
        <Button onClick={openCreate} className="font-bold gap-2">
          <Plus className="size-4" /> New popup
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
          <Loader2 className="size-5 animate-spin" /> Loading popups…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-slate-50 p-10 text-center text-slate-500">
          No popups yet. Create one to show notices on the website.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-bold text-slate-900 truncate">{row.title || "Untitled"}</p>
                  <Badge variant={row.is_active ? "default" : "secondary"} className="text-[10px]">
                    {row.is_active ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {row.popup_type}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{pagesLabel(row.pages)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{scheduleLabel(row)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">On</Label>
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(v) => void handleToggle(row, v)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="size-3.5 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void handleDelete(row)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit popup" : "New popup"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Admissions open"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(["text", "image"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={form.popup_type === t ? "default" : "outline"}
                    size="sm"
                    className="capitalize"
                    onClick={() => setForm((f) => ({ ...f, popup_type: t }))}
                  >
                    {t}-based
                  </Button>
                ))}
              </div>
            </div>

            {form.popup_type === "text" ? (
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Write the notice visitors should see…"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Image</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {previewSrc ? (
                  <img src={previewSrc} alt="Preview" className="max-h-40 rounded-lg border object-contain" />
                ) : null}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Button label (optional)</Label>
                <Input
                  value={form.cta_label}
                  onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
                  placeholder="Learn more"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Button / image link (optional)</Label>
                <Input
                  value={form.cta_url}
                  onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Start date & time</Label>
                <Input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date & time</Label>
                <Input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">Leave dates empty to show whenever the popup is enabled.</p>

            <div className="space-y-2">
              <Label>Show on pages</Label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 max-h-52 overflow-y-auto">
                {POPUP_PAGE_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.pages.includes(opt.key)}
                      onCheckedChange={() => togglePage(opt.key)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 mt-5">
                <Label htmlFor="popup-active">Enabled</Label>
                <Switch
                  id="popup-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save popup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
