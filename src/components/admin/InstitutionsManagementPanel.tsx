import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAllCollegesCatalog } from "@/lib/institutionCatalog";
import { resolveStorageUrl } from "@/lib/storageUrl";

type Props = {
  isActive?: boolean;
};

export function InstitutionsManagementPanel({ isActive = true }: Props) {
  const [unis, setUnis] = useState<{ id: string; name: string; logo_url?: string | null }[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string; university_id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUni, setNewUni] = useState("");
  const [newCollege, setNewCollege] = useState("");
  const [collegeUni, setCollegeUni] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: uniRows }, collegeRows] = await Promise.all([
        supabase.from("universities").select("id,name,logo_url").order("name"),
        fetchAllCollegesCatalog(supabase),
      ]);
      setUnis((uniRows || []) as typeof unis);
      setColleges(collegeRows as typeof colleges);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load institutions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void refresh();
  }, [isActive, refresh]);

  const collegesByUni = useMemo(() => {
    const map = new Map<string, typeof colleges>();
    for (const c of colleges) {
      const list = map.get(c.university_id) || [];
      list.push(c);
      map.set(c.university_id, list);
    }
    return map;
  }, [colleges]);

  const addUni = async () => {
    if (!newUni.trim()) return;
    try {
      const { error } = await supabase.from("universities").insert({ name: newUni.trim() });
      if (error) throw error;
      toast.success("University added");
      setNewUni("");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add university");
    }
  };

  const delUni = async (id: string, name: string) => {
    if (!confirm(`Delete university "${name}"?`)) return;
    try {
      const { error } = await supabase.from("universities").delete().eq("id", id);
      if (error) throw error;
      toast.success("University deleted");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete university");
    }
  };

  const addCollege = async () => {
    if (!newCollege.trim() || !collegeUni) {
      toast.error("Enter college name and select university");
      return;
    }
    try {
      const { error } = await supabase
        .from("colleges")
        .insert({ name: newCollege.trim(), university_id: collegeUni });
      if (error) throw error;
      toast.success("College added");
      setNewCollege("");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add college");
    }
  };

  const delCollege = async (id: string, name: string) => {
    if (!confirm(`Delete college "${name}"?`)) return;
    try {
      const { error } = await supabase.from("colleges").delete().eq("id", id);
      if (error) throw error;
      toast.success("College deleted");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete college");
    }
  };

  const uploadLogo = async (file: File, uniId: string) => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${uniId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("logos").getPublicUrl(fileName);
      const publicUrl = resolveStorageUrl(data.publicUrl) || data.publicUrl;
      const { error } = await supabase.from("universities").update({ logo_url: publicUrl }).eq("id", uniId);
      if (error) throw error;
      toast.success("Logo uploaded");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Logo upload failed");
    }
  };

  if (!isActive) return null;

  if (loading && unis.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black flex items-center gap-2">
          <Building2 className="size-5 text-primary" /> Academic Partners
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage universities and colleges — same controls as Admin settings.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 border-none shadow-elegant space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Plus className="size-4" /> Add University
          </h3>
          <div className="flex gap-2">
            <Input
              value={newUni}
              onChange={(e) => setNewUni(e.target.value)}
              placeholder="University name"
            />
            <Button onClick={() => void addUni()}>Add</Button>
          </div>
        </Card>

        <Card className="p-5 border-none shadow-elegant space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Plus className="size-4" /> Add College
          </h3>
          <Select value={collegeUni} onValueChange={setCollegeUni}>
            <SelectTrigger>
              <SelectValue placeholder="Select university" />
            </SelectTrigger>
            <SelectContent>
              {unis.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              value={newCollege}
              onChange={(e) => setNewCollege(e.target.value)}
              placeholder="College name"
            />
            <Button onClick={() => void addCollege()}>Add</Button>
          </div>
        </Card>
      </div>

      <Card className="p-4 border-none shadow-elegant overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary">{unis.length} Universities</Badge>
          <Badge variant="outline">{colleges.length} Colleges</Badge>
        </div>
        <div className="overflow-auto max-h-[520px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>University</TableHead>
                <TableHead>Logo</TableHead>
                <TableHead>Colleges</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unis.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-semibold">{u.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {u.logo_url ? (
                        <img
                          src={resolveStorageUrl(u.logo_url) || u.logo_url}
                          alt=""
                          className="size-8 rounded object-contain bg-white border"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <Label className="cursor-pointer">
                        <Upload className="size-4 text-primary" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadLogo(file, u.id);
                          }}
                        />
                      </Label>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {(collegesByUni.get(u.id) || []).slice(0, 8).map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                          <span>{c.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500"
                            onClick={() => void delCollege(c.id, c.name)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      ))}
                      {(collegesByUni.get(u.id) || []).length > 8 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{(collegesByUni.get(u.id) || []).length - 8} more
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => void delUni(u.id, u.name)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
