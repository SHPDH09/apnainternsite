import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Building2, ImagePlus, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveStorageUrl } from "@/lib/storageUrl";
import {
  fetchUniversitiesWithLogos,
  removeUniversityLogo,
  uploadUniversityLogo,
  type UniversityWithLogo,
} from "@/lib/universityLogoApi";

type Props = {
  client: SupabaseClient;
  currentUserId: string | null;
};

export function UniversityLogoManagementPanel({ client, currentUserId }: Props) {
  const [rows, setRows] = useState<UniversityWithLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUniIdRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchUniversitiesWithLogos(client));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load universities.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [rows, search]);

  const withLogoCount = useMemo(
    () => rows.filter((row) => Boolean(row.logo_url?.trim())).length,
    [rows]
  );

  const openFilePicker = (universityId: string) => {
    pendingUniIdRef.current = universityId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (file: File | undefined) => {
    const universityId = pendingUniIdRef.current;
    pendingUniIdRef.current = null;
    if (!file || !universityId) return;

    setUploadingId(universityId);
    try {
      await uploadUniversityLogo(client, universityId, file, currentUserId);
      toast.success("University logo uploaded. It will appear on the home page and project reports.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async (row: UniversityWithLogo) => {
    if (!confirm(`Remove logo for ${row.name}?`)) return;
    setUploadingId(row.id);
    try {
      await removeUniversityLogo(client, row.id);
      toast.success("Logo removed.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove logo.");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFileChange(e.target.files?.[0])}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">University Logos</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload a logo for each partner university. Logos appear on the home page partner section
            and on auto-generated project reports for that university.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1">
            {withLogoCount} / {rows.length} with logo
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            Home page shows universities with logos only
          </Badge>
        </div>
      </div>

      <Card className="border-slate-200/80 p-4 shadow-soft">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search university…"
            className="pl-9"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Loading universities…
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-18rem)] pr-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => {
              const logoSrc = row.logo_url
                ? resolveStorageUrl(row.logo_url) || row.logo_url
                : null;
              const busy = uploadingId === row.id;

              return (
                <Card
                  key={row.id}
                  className="overflow-hidden border-slate-200/80 shadow-soft transition hover:shadow-elegant"
                >
                  <div className="flex items-start gap-4 p-5">
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                      {logoSrc ? (
                        <img src={logoSrc} alt="" className="size-full object-contain p-2" />
                      ) : (
                        <Building2 className="size-8 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-3 text-sm font-bold leading-snug text-slate-800">
                        {row.name}
                      </p>
                      <Badge
                        variant={logoSrc ? "default" : "outline"}
                        className="mt-2 text-[10px] uppercase tracking-wider"
                      >
                        {logoSrc ? "Live on home page" : "No logo yet"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                    <Label htmlFor={`uni-logo-${row.id}`} className="flex-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full gap-2"
                        disabled={busy}
                        onClick={() => openFilePicker(row.id)}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : logoSrc ? (
                          <Upload className="size-4" />
                        ) : (
                          <ImagePlus className="size-4" />
                        )}
                        {logoSrc ? "Replace logo" : "Upload logo"}
                      </Button>
                    </Label>
                    {logoSrc ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:bg-destructive/10"
                        disabled={busy}
                        onClick={() => void handleRemove(row)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No universities match your search.
            </p>
          ) : null}
        </ScrollArea>
      )}
    </div>
  );
}
