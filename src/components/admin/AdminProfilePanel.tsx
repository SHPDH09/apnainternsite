import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CreditCard,
  Download,
  IdCard,
  Loader2,
  Shield,
  User,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge as UiBadge } from "@/components/ui/badge";
import { IdCard as IdCardTemplate, type IdCardData } from "@/components/IdCard";
import {
  generateIdCardNumber,
  resolveIdCardPosition,
  saveIdCardRecord,
} from "@/lib/idCardApi";
import { captureIdCardPng } from "@/lib/idCardPdf";
import { resolveStorageUrl } from "@/lib/storageUrl";
import type { AdminStaffProfile } from "@/lib/staffProfile";
import { ACTOR_TAG_LABELS, resolveActorContext } from "@/lib/adminActionLog";

type AdminProfilePanelProps = {
  userId: string;
  userEmail: string;
  isActive?: boolean;
  onLogAction?: (
    action_type: string,
    entity_type: string,
    description: string,
    metadata?: Record<string, unknown>
  ) => void | Promise<void>;
};

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 break-all">{value?.trim() || "—"}</p>
    </div>
  );
}

export function AdminProfilePanel({
  userId,
  userEmail,
  isActive = true,
  onLogAction,
}: AdminProfilePanelProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<AdminStaffProfile> | null>(null);
  const [roleLabel, setRoleLabel] = useState("Administrator");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [previewData, setPreviewData] = useState<IdCardData | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const actor = await resolveActorContext(supabase, userId, userEmail);
      setRoleLabel(actor.actor_tag || ACTOR_TAG_LABELS.admin);

      const { data: staffRow } = await supabase
        .from("admin_staff")
        .select("*")
        .or(`id.eq.${userId},email.ilike.${userEmail}`)
        .maybeSingle();

      if (staffRow) {
        setProfile(staffRow as AdminStaffProfile);
        setImageUrl(
          resolveStorageUrl(staffRow.profile_image_url || "") || staffRow.profile_image_url || null
        );
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, full_name, email, contact_number, created_at")
        .eq("id", userId)
        .maybeSingle();

      setProfile({
        id: userId,
        email: profileRow?.email || userEmail,
        full_name: profileRow?.full_name || actor.actor_name,
        mobile_number: profileRow?.contact_number || null,
        role_tag: actor.actor_role,
        permissions: null,
        account_number: null,
        ifsc_code: null,
        bank_name: null,
        aadhaar_number: null,
        pan_number: null,
        profile_image_url: null,
        employee_code: null,
        is_blocked: false,
        created_at: profileRow?.created_at,
      });
      setImageUrl(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load profile";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail]);

  useEffect(() => {
    if (isActive) void loadProfile();
  }, [isActive, loadProfile]);

  const uploadImage = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `staff-profiles/${userId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      const publicUrl = resolveStorageUrl(data.publicUrl) || data.publicUrl;

      const { data: staffRow } = await supabase
        .from("admin_staff")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (staffRow) {
        const { error } = await supabase
          .from("admin_staff")
          .update({ profile_image_url: publicUrl, updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (error) throw error;
      }

      setImageUrl(publicUrl);
      setProfile((p) => (p ? { ...p, profile_image_url: publicUrl } : p));
      toast.success("Profile photo updated");
      await onLogAction?.("UPDATE", "profile", "Updated profile photo", { user_id: userId });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const prepareIdCard = async () => {
    if (!profile) return;
    setGeneratingCard(true);
    try {
      const cardNumber = await generateIdCardNumber(supabase, "staff");
      const position = resolveIdCardPosition("staff", {
        role_tag: profile.role_tag || roleLabel,
        position: roleLabel,
      });

      let formattedJoiningDate = "";
      const rawJoining = profile.created_at || "";
      if (rawJoining) {
        const d = new Date(rawJoining);
        if (!Number.isNaN(d.getTime())) {
          formattedJoiningDate = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
        }
      }

      const data: IdCardData = {
        id: profile.id || userId,
        cardNumber,
        userName: profile.full_name || userEmail.split("@")[0] || "Employee",
        userEmail: profile.email || userEmail,
        userPhone: profile.mobile_number || "",
        position,
        category: "staff",
        profileImageUrl: profile.profile_image_url || imageUrl || "",
        registrationId: profile.employee_code || undefined,
        joiningDate: formattedJoiningDate,
      };
      setPreviewData(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not prepare ID card");
    } finally {
      setGeneratingCard(false);
    }
  };

  const downloadIdCard = async () => {
    if (!previewData) return;
    setGeneratingCard(true);
    try {
      await saveIdCardRecord(supabase, {
        card_number: previewData.cardNumber,
        user_id: previewData.id,
        user_name: previewData.userName,
        user_email: previewData.userEmail,
        category: "staff",
        generated_by: userEmail,
        status: "generated",
        metadata: {
          source: "admin_profile",
          phone: previewData.userPhone || "",
          position: previewData.position || "",
          registration_id: previewData.registrationId || "",
          joining_date: previewData.joiningDate || "",
        },
      });

      const imgData = await captureIdCardPng(previewData);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [350, 560],
        compress: true,
      });
      pdf.addImage(imgData, "PNG", 0, 0, 350, 560);
      pdf.save(`${previewData.cardNumber}_${previewData.userName.replace(/\s+/g, "_")}.pdf`);
      toast.success("Employee ID card downloaded");
      await onLogAction?.("CREATE", "id_card", `Generated employee ID card for ${previewData.userName}`, {
        card_number: previewData.cardNumber,
        user_id: previewData.id,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setGeneratingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" />
        Loading profile…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <User className="size-6 text-primary" /> My Profile
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Employee details and ID card for your admin account.
        </p>
      </div>

      <Card className="p-6 border-none shadow-elegant">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="size-28 rounded-2xl object-cover border shadow-sm" />
            ) : (
              <div className="size-28 rounded-2xl bg-primary/10 flex items-center justify-center">
                <User className="size-12 text-primary" />
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 size-9 rounded-full bg-white border shadow flex items-center justify-center cursor-pointer hover:bg-slate-50">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4 text-slate-600" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadImage(f);
                }}
              />
            </label>
          </div>

          <div className="flex-1 space-y-2">
            <h3 className="text-xl font-black text-slate-900">{profile?.full_name || "Administrator"}</h3>
            <p className="text-sm text-muted-foreground">{profile?.email || userEmail}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <UiBadge variant="secondary" className="gap-1">
                <Shield className="size-3" />
                {roleLabel}
              </UiBadge>
              {profile?.employee_code ? (
                <UiBadge variant="outline" className="font-mono text-xs">
                  {profile.employee_code}
                </UiBadge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 mt-8 pt-6 border-t">
          <ReadOnlyField label="Full Name" value={profile?.full_name} />
          <ReadOnlyField label="Email Address" value={profile?.email || userEmail} />
          <ReadOnlyField label="Mobile Number" value={profile?.mobile_number} />
          <ReadOnlyField label="Employee Code" value={profile?.employee_code} />
          <ReadOnlyField label="Role Tag" value={profile?.role_tag || roleLabel} />
          <ReadOnlyField
            label="Member Since"
            value={
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : null
            }
          />
          <ReadOnlyField label="Bank Name" value={profile?.bank_name} />
          <ReadOnlyField label="Account Number" value={profile?.account_number} />
          <ReadOnlyField label="IFSC Code" value={profile?.ifsc_code} />
          <ReadOnlyField label="Aadhaar Number" value={profile?.aadhaar_number} />
          <ReadOnlyField label="PAN Number" value={profile?.pan_number} />
        </div>
      </Card>

      <Card className="p-6 border-none shadow-elegant space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <IdCard className="size-5 text-primary" /> Employee ID Card
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Generate and download your official Apna Intern employee ID card.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void prepareIdCard()}
              disabled={generatingCard || !profile}
            >
              {generatingCard ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="size-4 mr-2" />
              )}
              Preview Card
            </Button>
            {previewData ? (
              <Button onClick={() => void downloadIdCard()} disabled={generatingCard}>
                {generatingCard ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Download className="size-4 mr-2" />
                )}
                Download PDF
              </Button>
            ) : null}
          </div>
        </div>

        {previewData ? (
          <div className="flex justify-center pt-4 overflow-x-auto">
            <div className="scale-[0.55] sm:scale-[0.65] origin-top">
              <IdCardTemplate ref={cardRef} data={previewData} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">
            Click Preview Card to generate your employee ID card.
          </p>
        )}
      </Card>
    </div>
  );
}
