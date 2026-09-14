import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSiteContact,
  deleteSiteContact,
  fetchAdminSiteContacts,
  updateSiteContact,
  type SiteContactWrite,
} from "@/lib/siteContactApi";
import {
  CONTACT_DISPLAY_CONTEXT_OPTIONS,
  CONTACT_TYPE_OPTIONS,
  defaultHrefForContact,
  type SiteContactDetail,
} from "@/lib/siteContacts";

type Props = {
  client: SupabaseClient;
};

type FormState = {
  contact_type: SiteContactDetail["contact_type"];
  label: string;
  value: string;
  href: string;
  display_contexts: string[];
  is_active: boolean;
  sort_order: number;
};

const emptyForm = (): FormState => ({
  contact_type: "phone",
  label: "",
  value: "",
  href: "",
  display_contexts: ["footer"],
  is_active: true,
  sort_order: 0,
});

function formFromRow(row: SiteContactDetail): FormState {
  return {
    contact_type: row.contact_type,
    label: row.label || "",
    value: row.value || "",
    href: row.href || "",
    display_contexts: row.display_contexts?.length ? row.display_contexts : ["footer"],
    is_active: row.is_active !== false,
    sort_order: row.sort_order ?? 0,
  };
}

function contextsLabel(contexts: string[]): string {
  if (!contexts?.length) return "—";
  if (contexts.includes("all")) return "All pages";
  return contexts
    .map((k) => CONTACT_DISPLAY_CONTEXT_OPTIONS.find((o) => o.key === k)?.label || k)
    .join(", ");
}

function toWritePayload(form: FormState): SiteContactWrite {
  const contexts = form.display_contexts.includes("all")
    ? ["all"]
    : form.display_contexts.filter((c) => c !== "all");
  const href =
    form.href.trim() ||
    defaultHrefForContact(form.contact_type, form.value) ||
    null;
  return {
    contact_type: form.contact_type,
    label: form.label.trim() || CONTACT_TYPE_OPTIONS.find((t) => t.key === form.contact_type)?.label || "Contact",
    value: form.value.trim(),
    href,
    display_contexts: contexts.length ? contexts : ["footer"],
    is_active: form.is_active,
    sort_order: Number(form.sort_order) || 0,
  };
}

export function ContactDetailsManagementPanel({ client }: Props) {
  const [rows, setRows] = useState<SiteContactDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SiteContactDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminSiteContacts(client));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load contact details.";
      if (/relation .*site_contact_details.* does not exist|Could not find the table/i.test(msg)) {
        toast.error("Run the site_contacts SQL migration, then reload.");
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
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: SiteContactDetail) => {
    setEditing(row);
    setForm(formFromRow(row));
    setDialogOpen(true);
  };

  const toggleContext = (key: string, checked: boolean) => {
    setForm((prev) => {
      if (key === "all") {
        return { ...prev, display_contexts: checked ? ["all"] : ["footer"] };
      }
      const without = prev.display_contexts.filter((c) => c !== "all" && c !== key);
      return {
        ...prev,
        display_contexts: checked ? [...without, key] : without.length ? without : ["footer"],
      };
    });
  };

  const handleSave = async () => {
    if (!form.value.trim()) {
      toast.error("Value is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = toWritePayload(form);
      if (editing) {
        await updateSiteContact(client, editing.id, payload);
        toast.success("Contact detail updated.");
      } else {
        await createSiteContact(client, payload);
        toast.success("Contact detail added.");
      }
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SiteContactDetail) => {
    if (!window.confirm(`Delete "${row.label || row.value}"?`)) return;
    try {
      await deleteSiteContact(client, row.id);
      toast.success("Deleted.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const handleToggleActive = async (row: SiteContactDetail) => {
    try {
      await updateSiteContact(client, row.id, { is_active: !row.is_active });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Phone className="size-5 text-primary" />
            Contact Details Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage phone numbers, emails, addresses, and other contact information shown on the website footer and other pages.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-bold">
          <Plus className="size-4" /> Add contact
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          No contact details yet. Add your first entry or run the SQL migration to seed defaults.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] font-black uppercase">
                    {row.contact_type}
                  </Badge>
                  {!row.is_active && (
                    <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{contextsLabel(row.display_contexts)}</span>
                </div>
                <p className="font-bold text-slate-900">{row.label || "—"}</p>
                <p className="text-sm text-slate-600 break-all">{row.value}</p>
                {row.href && (
                  <p className="text-[11px] text-muted-foreground truncate">{row.href}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <Switch checked={row.is_active} onCheckedChange={() => void handleToggleActive(row)} />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Active</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="size-3.5" />
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
            <DialogTitle>{editing ? "Edit contact detail" : "Add contact detail"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.contact_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, contact_type: v as SiteContactDetail["contact_type"] }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Support" />
            </div>
            <div className="space-y-1.5">
              <Label>Value *</Label>
              <Input
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.contact_type === "email" ? "support@example.com" : "+91 70000 00000"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link (optional)</Label>
              <Input
                value={form.href}
                onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                placeholder="tel:, mailto:, or https:// — auto-filled if blank"
              />
            </div>
            <div className="space-y-2">
              <Label>Display on</Label>
              {CONTACT_DISPLAY_CONTEXT_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.display_contexts.includes(opt.key) || form.display_contexts.includes("all")}
                    onCheckedChange={(v) => toggleContext(opt.key, !!v)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: !!v }))} />
                <Label>Enabled</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
