import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { fetchCouponsForPartner, updateReferralCoupon, type ReferralCouponRow } from "@/lib/referralCoupons";
import { partnerAccessModeLabel, type PartnerAccessMode } from "@/lib/partnerAccessMode";
import { toast } from "sonner";

const DETAIL_PAGE_SIZE = 20;

type PartnerSummary = {
  id: string;
  full_name: string;
  referral_code: string;
  access_mode?: PartnerAccessMode | null;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
  college_name: string | null;
  status: string | null;
  created_at: string | null;
};

type Props = {
  partner: PartnerSummary | null;
  students: StudentRow[];
  studentsTotal: number;
  studentsLoading: boolean;
  studentPage: number;
  onStudentPageChange: (page: number) => void;
  studentSearch: string;
  onStudentSearchChange: (value: string) => void;
  onExportStudents?: () => void;
};

export function PartnerDetailHistoryPanel({
  partner,
  students,
  studentsTotal,
  studentsLoading,
  studentPage,
  onStudentPageChange,
  studentSearch,
  onStudentSearchChange,
  onExportStudents,
}: Props) {
  const [coupons, setCoupons] = useState<ReferralCouponRow[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [editCoupon, setEditCoupon] = useState<ReferralCouponRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMax, setEditMax] = useState("");
  const [savingCoupon, setSavingCoupon] = useState(false);

  const loadCoupons = useCallback(async () => {
    if (!partner?.id) return;
    setCouponsLoading(true);
    try {
      setCoupons(await fetchCouponsForPartner(supabase, partner.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load coupons.");
    } finally {
      setCouponsLoading(false);
    }
  }, [partner?.id]);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const openCouponEdit = (row: ReferralCouponRow) => {
    setEditCoupon(row);
    setEditAmount(row.coupon_amount != null ? String(row.coupon_amount) : "");
    setEditMax(row.max_students != null ? String(row.max_students) : "");
  };

  const saveCouponEdit = async () => {
    if (!editCoupon) return;
    setSavingCoupon(true);
    try {
      await updateReferralCoupon(supabase, editCoupon.id, {
        coupon_amount: editAmount.trim() ? Number(editAmount) : null,
        max_students: editMax.trim() ? Number(editMax) : null,
      });
      toast.success("Coupon updated.");
      setEditCoupon(null);
      await loadCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingCoupon(false);
    }
  };

  if (!partner) return null;

  const studentPageCount = Math.max(1, Math.ceil(studentsTotal / DETAIL_PAGE_SIZE));

  return (
    <Tabs defaultValue="referrals" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="referrals">Referral history</TabsTrigger>
        <TabsTrigger value="coupons">Coupon history</TabsTrigger>
      </TabsList>

      <TabsContent value="referrals" className="space-y-3 mt-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search referrals…"
            value={studentSearch}
            onChange={(e) => onStudentSearchChange(e.target.value)}
            className="h-9"
          />
          {onExportStudents ? (
            <Button type="button" variant="outline" size="sm" onClick={onExportStudents}>
              Export CSV
            </Button>
          ) : null}
        </div>
        {studentsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                      No referral signups yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </TableCell>
                      <TableCell className="text-xs">{s.contact_number || "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-[120px]">{s.college_name || "—"}</TableCell>
                      <TableCell className="text-xs">{s.status || "Applied"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        {studentsTotal > DETAIL_PAGE_SIZE ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              disabled={studentPage <= 0}
              onClick={() => onStudentPageChange(Math.max(0, studentPage - 1))}
            >
              Previous
            </Button>
            <span>
              Page {studentPage + 1} / {studentPageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={studentPage >= studentPageCount - 1}
              onClick={() => onStudentPageChange(studentPage + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="coupons" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">
          Access: {partnerAccessModeLabel(partner.access_mode)} · {coupons.length} coupon(s)
        </p>
        {couponsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                      No coupons for this partner yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-bold">{c.coupon_code}</TableCell>
                      <TableCell className="text-xs">{c.coupon_amount != null ? `₹${c.coupon_amount}` : "—"}</TableCell>
                      <TableCell className="text-xs">
                        {c.university_name || "Any uni"} · {c.college_name || "Any college"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="secondary">{c.click_count} clicks</Badge>
                          <Badge variant="outline">{c.redemption_count} regs</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openCouponEdit(c)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {editCoupon ? (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
            <p className="text-sm font-bold">Edit {editCoupon.coupon_code}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Amount (₹)</Label>
                <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} type="number" min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max students</Label>
                <Input value={editMax} onChange={(e) => setEditMax(e.target.value)} type="number" min={1} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={savingCoupon} onClick={() => void saveCouponEdit()}>
                Save coupon
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditCoupon(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
