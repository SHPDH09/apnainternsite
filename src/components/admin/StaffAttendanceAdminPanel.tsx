import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminCardClass } from "@/components/admin/ui/adminStyles";
import { EmployeeAttendancePanel, type StaffEmployeeOption } from "@/components/admin/EmployeeAttendancePanel";
import { requestCurrentPosition } from "@/lib/geoLocation";
import {
  assignStaffOffice,
  deleteStaffAttendanceOffice,
  ensureStaffOfficesSchema,
  listStaffAttendanceOffices,
  listStaffOfficeAssignments,
  removeStaffOfficeAssignment,
  upsertStaffAttendanceOffice,
  type StaffAttendanceOffice,
  type StaffOfficeAssignment,
} from "@/lib/staffAttendanceOffices";
import { cn } from "@/lib/utils";

type Props = {
  employees: StaffEmployeeOption[];
  currentUserId: string | null;
  isActive?: boolean;
};

type OfficeForm = {
  id?: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  maxGpsAccuracyM: string;
  requireFace: boolean;
  requireGeo: boolean;
  isActive: boolean;
};

const emptyOfficeForm = (): OfficeForm => ({
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radiusMeters: "200",
  maxGpsAccuracyM: "100",
  requireFace: true,
  requireGeo: true,
  isActive: true,
});

function officeToForm(o: StaffAttendanceOffice): OfficeForm {
  return {
    id: o.id,
    name: o.name,
    address: o.address || "",
    latitude: String(o.latitude),
    longitude: String(o.longitude),
    radiusMeters: String(o.radius_meters),
    maxGpsAccuracyM: o.max_gps_accuracy_m != null ? String(o.max_gps_accuracy_m) : "100",
    requireFace: o.require_face,
    requireGeo: o.require_geo,
    isActive: o.is_active,
  };
}

export function StaffAttendanceAdminPanel({ employees, currentUserId, isActive = true }: Props) {
  const [subTab, setSubTab] = useState("locations");
  const [offices, setOffices] = useState<StaffAttendanceOffice[]>([]);
  const [assignments, setAssignments] = useState<StaffOfficeAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
  const [officeForm, setOfficeForm] = useState<OfficeForm>(emptyOfficeForm());
  const [locating, setLocating] = useState(false);

  const assignmentMap = useMemo(() => {
    const m = new Map<string, StaffOfficeAssignment>();
    assignments.forEach((a) => m.set(a.employee_id, a));
    return m;
  }, [assignments]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureStaffOfficesSchema();
      const [officeRows, assignmentRows] = await Promise.all([
        listStaffAttendanceOffices(),
        listStaffOfficeAssignments(),
      ]);
      setOffices(officeRows);
      setAssignments(assignmentRows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load attendance config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) void load();
  }, [isActive, load]);

  const openCreateOffice = () => {
    setOfficeForm(emptyOfficeForm());
    setOfficeDialogOpen(true);
  };

  const openEditOffice = (office: StaffAttendanceOffice) => {
    setOfficeForm(officeToForm(office));
    setOfficeDialogOpen(true);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const pos = await requestCurrentPosition();
      setOfficeForm((f) => ({
        ...f,
        latitude: pos.latitude.toFixed(6),
        longitude: pos.longitude.toFixed(6),
      }));
      toast.success("Coordinates filled from your device GPS");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not read location");
    } finally {
      setLocating(false);
    }
  };

  const saveOffice = async () => {
    const lat = parseFloat(officeForm.latitude);
    const lng = parseFloat(officeForm.longitude);
    const radius = parseInt(officeForm.radiusMeters, 10);
    const maxAcc = officeForm.maxGpsAccuracyM.trim()
      ? parseFloat(officeForm.maxGpsAccuracyM)
      : null;

    if (!officeForm.name.trim()) {
      toast.error("Office name is required");
      return;
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error("Valid latitude and longitude are required");
      return;
    }
    if (Number.isNaN(radius) || radius < 25 || radius > 5000) {
      toast.error("Radius must be between 25 and 5000 meters");
      return;
    }

    setSaving(true);
    try {
      await upsertStaffAttendanceOffice({
        id: officeForm.id,
        name: officeForm.name,
        address: officeForm.address,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        maxGpsAccuracyM: maxAcc,
        requireFace: officeForm.requireFace,
        requireGeo: officeForm.requireGeo,
        isActive: officeForm.isActive,
      });
      toast.success(officeForm.id ? "Office updated" : "Office created");
      setOfficeDialogOpen(false);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save office";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOffice = async (id: string) => {
    if (!window.confirm("Delete this office? Employees assigned to it must be reassigned first.")) return;
    try {
      await deleteStaffAttendanceOffice(id);
      toast.success("Office removed");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not delete office");
    }
  };

  const handleAssign = async (employeeId: string, officeId: string) => {
    if (!officeId || officeId === "none") {
      try {
        await removeStaffOfficeAssignment(employeeId);
        toast.success("Office assignment removed");
        await load();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not remove assignment");
      }
      return;
    }

    try {
      await assignStaffOffice({
        employeeId,
        officeId,
        assignedBy: currentUserId,
      });
      toast.success("Office assigned");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not assign office");
    }
  };

  const activeOffices = offices.filter((o) => o.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" /> Staff Attendance
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure office locations, assign employees, and manage manual attendance with geo + face
          verification logs.
        </p>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-slate-100 flex-wrap h-auto gap-1">
          <TabsTrigger value="locations" className="gap-1.5">
            <Building2 className="size-3.5" /> Office Locations
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1.5">
            <UserCheck className="size-3.5" /> Employee Assignments
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-1.5">
            <Users className="size-3.5" /> Manual & Records
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="mt-4 space-y-4">
          <Card className={cn(adminCardClass, "p-6 space-y-4")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800">Office locations</h3>
                <p className="text-sm text-muted-foreground">
                  Set GPS coordinates, allowed radius, and anti-cheat rules per office.
                </p>
              </div>
              <Button onClick={openCreateOffice} className="gap-2 font-bold">
                <Plus className="size-4" /> Add office
              </Button>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Radius</TableHead>
                    <TableHead>Anti-cheat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="size-5 animate-spin inline mr-2" /> Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && offices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No offices configured yet. Add your first office location.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    offices.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <p className="font-medium">{o.name}</p>
                          {o.address ? (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{o.address}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-600">
                          {o.latitude.toFixed(5)}, {o.longitude.toFixed(5)}
                        </TableCell>
                        <TableCell>{o.radius_meters} m</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {o.require_geo && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                                GPS ≤{o.max_gps_accuracy_m ?? 100}m
                              </Badge>
                            )}
                            {o.require_face && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700">
                                Face
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              o.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600"
                            }
                          >
                            {o.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditOffice(o)}>
                              Edit
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-500"
                              onClick={() => void handleDeleteOffice(o.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <Card className={cn(adminCardClass, "p-6 space-y-4")}>
            <div>
              <h3 className="font-bold text-slate-800">Employee → office assignment</h3>
              <p className="text-sm text-muted-foreground">
                Each staff member must be assigned exactly one office before they can self mark
                attendance. Unassigned staff cannot check in.
              </p>
            </div>

            {!activeOffices.length && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Create at least one active office location first.
              </p>
            )}

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Assigned office</TableHead>
                    <TableHead>Assigned at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!employees.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No staff employees found.
                      </TableCell>
                    </TableRow>
                  )}
                  {employees.map((e) => {
                    const a = assignmentMap.get(e.id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <p className="font-medium">{e.full_name || e.email}</p>
                          <p className="text-xs text-muted-foreground">{e.email}</p>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <Select
                            value={a?.office_id || "none"}
                            onValueChange={(v) => void handleAssign(e.id, v)}
                            disabled={!activeOffices.length}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select office" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Not assigned —</SelectItem>
                              {activeOffices.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a?.assigned_at
                            ? new Date(a.assigned_at).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {assignments.length} of {employees.length} employees have an office assigned.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <EmployeeAttendancePanel
            employees={employees}
            currentUserId={currentUserId}
            offices={offices}
            isActive={isActive && subTab === "records"}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={officeDialogOpen} onOpenChange={setOfficeDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{officeForm.id ? "Edit office" : "Add office location"}</DialogTitle>
            <DialogDescription>
              Staff must be within the radius with reliable GPS. Tight accuracy limits reduce mock-location
              cheating.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Office name *</Label>
              <Input
                value={officeForm.name}
                onChange={(e) => setOfficeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Patna HQ"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                rows={2}
                value={officeForm.address}
                onChange={(e) => setOfficeForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Full address (optional, shown to staff)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Latitude *</Label>
                <Input
                  value={officeForm.latitude}
                  onChange={(e) => setOfficeForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="25.5941"
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude *</Label>
                <Input
                  value={officeForm.longitude}
                  onChange={(e) => setOfficeForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="85.1376"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={locating}
              onClick={() => void useCurrentLocation()}
            >
              {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
              Use my current GPS
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Allowed radius (m)</Label>
                <Input
                  type="number"
                  min={25}
                  max={5000}
                  value={officeForm.radiusMeters}
                  onChange={(e) => setOfficeForm((f) => ({ ...f, radiusMeters: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max GPS accuracy (m)</Label>
                <Input
                  type="number"
                  min={10}
                  max={500}
                  value={officeForm.maxGpsAccuracyM}
                  onChange={(e) => setOfficeForm((f) => ({ ...f, maxGpsAccuracyM: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">Reject if device reports worse accuracy</p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Verification rules</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={officeForm.requireGeo}
                  onCheckedChange={(c) => setOfficeForm((f) => ({ ...f, requireGeo: !!c }))}
                />
                <span className="text-sm">Require GPS location within radius</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={officeForm.requireFace}
                  onCheckedChange={(c) => setOfficeForm((f) => ({ ...f, requireFace: !!c }))}
                />
                <span className="text-sm">Require face match with profile photo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={officeForm.isActive}
                  onCheckedChange={(c) => setOfficeForm((f) => ({ ...f, isActive: !!c }))}
                />
                <span className="text-sm">Office is active</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfficeDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveOffice()} disabled={saving} className="font-bold">
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Save office
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
