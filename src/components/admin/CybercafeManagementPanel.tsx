import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CyberCafeRow = {
  id: string;
  shop_name: string;
  owner_name?: string | null;
  email: string;
  phone?: string | null;
  location?: string | null;
  status: string;
  rejection_reason?: string | null;
};

function formatCyberCafeStatusLabel(status: string | undefined | null): string {
  if (!status) return "—";
  if (status === "pending_kyc") return "Pending approval";
  return status.replace(/_/g, " ");
}

type Props = {
  isActive?: boolean;
};

export function CybercafeManagementPanel({ isActive = true }: Props) {
  const [cafes, setCafes] = useState<CyberCafeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedCafe, setSelectedCafe] = useState<CyberCafeRow | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<CyberCafeRow>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cybercafe_profiles")
        .select("id, shop_name, owner_name, email, phone, location, status, rejection_reason")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCafes((data || []) as CyberCafeRow[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load cyber cafes");
      setCafes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void refresh();
  }, [isActive, refresh]);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    let reason: string | null = null;
    if (action === "rejected") {
      reason = prompt("Reason for rejection:");
      if (reason === null) return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("cybercafe_profiles")
        .update({ status: action, rejection_reason: reason })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Cyber Cafe ${action}`);
      await refresh();
      if (selectedCafe?.id === id) {
        setSelectedCafe((prev) =>
          prev ? { ...prev, status: action, rejection_reason: reason } : prev
        );
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setProcessing(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedCafe) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("cybercafe_profiles")
        .update({
          shop_name: editData.shop_name,
          owner_name: editData.owner_name,
          email: editData.email,
          phone: editData.phone,
          location: editData.location,
        })
        .eq("id", selectedCafe.id);
      if (error) throw error;
      toast.success("Cyber cafe updated");
      setIsEditing(false);
      await refresh();
      setSelectedCafe((prev) => (prev ? { ...prev, ...editData } as CyberCafeRow : prev));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setProcessing(false);
    }
  };

  if (!isActive) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Store className="size-5 text-primary" /> Cyber Cafe Management
        </h2>
      </div>

      <Card className="p-0 border-none shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin inline" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                    Shop & Owner
                  </TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                    Contact
                  </TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                    Location
                  </TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                    Status
                  </TableHead>
                  <TableHead className="text-right font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cafes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                      No Cyber Cafes found.
                    </TableCell>
                  </TableRow>
                ) : (
                  cafes.map((cafe) => (
                    <TableRow key={cafe.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="font-bold text-sm text-slate-900">{cafe.shop_name}</div>
                        <div className="text-xs text-slate-500">{cafe.owner_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-900">{cafe.email}</div>
                        <div className="text-xs text-slate-500">{cafe.phone}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-[200px]">
                        {cafe.location || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-black uppercase tracking-widest ${
                            cafe.status === "approved"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : cafe.status === "rejected"
                                ? "bg-red-50 text-red-600 border-red-200"
                                : "bg-orange-50 text-orange-600 border-orange-200"
                          }`}
                        >
                          {formatCyberCafeStatusLabel(cafe.status)}
                        </Badge>
                        {cafe.rejection_reason && (
                          <div
                            className="text-[9px] text-red-500 mt-1 max-w-[150px] truncate"
                            title={cafe.rejection_reason}
                          >
                            Reason: {cafe.rejection_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-bold gap-1"
                            onClick={() => {
                              setSelectedCafe(cafe);
                              setEditData(cafe);
                              setIsEditing(false);
                              setViewOpen(true);
                            }}
                          >
                            <Eye className="size-3" /> View
                          </Button>
                          {(cafe.status === "pending_approval" || cafe.status === "pending_kyc") && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 h-8 text-xs font-bold"
                                disabled={processing}
                                onClick={() => void handleAction(cafe.id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 h-8 text-xs font-bold"
                                disabled={processing}
                                onClick={() => void handleAction(cafe.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {cafe.status === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 h-8 text-xs font-bold"
                              disabled={processing}
                              onClick={() => void handleAction(cafe.id, "rejected")}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg border-none shadow-elegant">
          <DialogDescription className="sr-only">Cyber cafe details</DialogDescription>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="size-5 text-primary" />
              {selectedCafe?.shop_name || "Cyber Cafe"}
            </DialogTitle>
          </DialogHeader>
          {selectedCafe && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="capitalize">
                  {formatCyberCafeStatusLabel(selectedCafe.status)}
                </Badge>
                {!isEditing ? (
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Details
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" disabled={processing} onClick={() => void saveEdit()}>
                      Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Shop name</Label>
                  {isEditing ? (
                    <Input
                      value={editData.shop_name || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, shop_name: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm font-semibold">{selectedCafe.shop_name}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Owner</Label>
                  {isEditing ? (
                    <Input
                      value={editData.owner_name || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, owner_name: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm">{selectedCafe.owner_name || "—"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  {isEditing ? (
                    <Input
                      value={editData.email || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm">{selectedCafe.email}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  {isEditing ? (
                    <Input
                      value={editData.phone || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm">{selectedCafe.phone || "—"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Location</Label>
                  {isEditing ? (
                    <Input
                      value={editData.location || ""}
                      onChange={(e) => setEditData((p) => ({ ...p, location: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm">{selectedCafe.location || "—"}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
