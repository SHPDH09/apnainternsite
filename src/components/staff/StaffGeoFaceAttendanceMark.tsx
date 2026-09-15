import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  ScanFace,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { haversineMeters, requestCurrentPosition } from "@/lib/geoLocation";
import { deriveStaffAttendanceWindow } from "@/lib/staffAttendanceWindows";
import {
  fetchStaffSelfAttendanceStatus,
  staffSelfCheckIn,
  staffSelfCheckOut,
  type StaffAttendanceStatusPayload,
} from "@/lib/staffSelfAttendance";
import {
  startStaffCamera,
  stopStaffCamera,
  verifyStaffFaceMatch,
} from "@/lib/staffFaceVerify";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { staffStatCardClass } from "@/components/staff/staffStyles";

type Props = {
  profileImageUrl?: string | null;
  isActive?: boolean;
  onMarked?: () => void;
};

export function StaffGeoFaceAttendanceMark({
  profileImageUrl,
  isActive = true,
  onMarked,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<StaffAttendanceStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [geoOk, setGeoOk] = useState<boolean | null>(null);
  const [geoDistance, setGeoDistance] = useState<number | null>(null);

  const avatarUrl =
    resolveStorageUrl(profileImageUrl || "") || profileImageUrl || "";

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchStaffSelfAttendanceStatus());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load attendance status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) void loadStatus();
  }, [isActive, loadStatus]);

  useEffect(() => {
    if (!isActive) {
      stopStaffCamera(streamRef.current);
      streamRef.current = null;
      setCameraReady(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    (async () => {
      try {
        streamRef.current = await startStaffCamera(video);
        if (!cancelled) setCameraReady(true);
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Camera access denied");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStaffCamera(streamRef.current);
      streamRef.current = null;
    };
  }, [isActive]);

  const windowState = deriveStaffAttendanceWindow({
    hasCheckIn: status?.has_check_in ?? false,
    hasCheckOut: status?.has_check_out ?? false,
    istMinutes: status?.ist_minutes,
  });

  const verifyLocation = async () => {
    const office = status?.office;
    if (!status?.office_assigned || !office) {
      throw new Error("No office assigned. Contact admin to assign your work location.");
    }
    const pos = await requestCurrentPosition();
    const accuracy = pos.accuracy ?? null;

    if (
      office.max_gps_accuracy_m != null &&
      accuracy != null &&
      accuracy > office.max_gps_accuracy_m
    ) {
      throw new Error(
        `GPS signal too weak (±${Math.round(accuracy)} m). Disable mock location, move outdoors, and retry.`
      );
    }

    const distance = haversineMeters(
      { latitude: pos.latitude, longitude: pos.longitude },
      { latitude: office.latitude, longitude: office.longitude }
    );
    setGeoDistance(Math.round(distance));
    const ok = distance <= office.radius_meters;
    setGeoOk(ok);
    if (!ok) {
      throw new Error(
        `You are ${Math.round(distance)} m from ${office.name} (max ${office.radius_meters} m)`
      );
    }
    return pos;
  };

  const runMark = async (action: "check_in" | "check_out") => {
    const video = videoRef.current;
    if (!video || !cameraReady) {
      toast.error("Camera is not ready");
      return;
    }
    if (!avatarUrl) {
      toast.error("Upload a profile photo in Profile first");
      return;
    }

    setBusy(true);
    try {
      const pos = await verifyLocation();
      const { score, matched } = await verifyStaffFaceMatch(avatarUrl, video);
      if (!matched) {
        throw new Error("Face did not match your profile photo. Try again in better light.");
      }

      if (action === "check_in") {
        await staffSelfCheckIn({
          latitude: pos.latitude,
          longitude: pos.longitude,
          faceScore: score,
          gpsAccuracyM: pos.accuracy ?? null,
        });
        toast.success("Check-in recorded");
      } else {
        await staffSelfCheckOut({
          latitude: pos.latitude,
          longitude: pos.longitude,
          faceScore: score,
          gpsAccuracyM: pos.accuracy ?? null,
        });
        toast.success("Check-out recorded");
      }

      await loadStatus();
      onMarked?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Attendance mark failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isActive) return null;

  return (
    <Card className={cn(staffStatCardClass, "mb-6 overflow-hidden p-0")}>
      <div className="border-b border-slate-200 bg-gradient-to-r from-[#0a101c] to-[#152238] px-5 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5AA3E6]">
              Geo + face attendance
            </p>
            <h3 className="text-lg font-semibold">Mark today&apos;s attendance</h3>
            <p className="mt-1 text-xs text-slate-300">
              Check-in from 10:00 AM · Check-out from 6:00 PM (IST)
            </p>
          </div>
          <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
            {loading ? "Loading…" : windowState.message}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 aspect-[4/3]">
            <video
              ref={videoRef}
              className="size-full object-cover mirror-video"
              playsInline
              muted
            />
            {!cameraReady ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-xs text-slate-300">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Starting camera…
              </div>
            ) : null}
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <ScanFace className="size-3.5" />
            Face is matched against your profile photo
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Clock className="size-3.5" /> Check-in
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {status?.check_in_at
                  ? new Date(status.check_in_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : windowState.canCheckIn
                    ? "Open now"
                    : "10:00 AM IST"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Clock className="size-3.5" /> Check-out
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {status?.check_out_at
                  ? new Date(status.check_out_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : windowState.canCheckOut
                    ? "Open now"
                    : "6:00 PM IST"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <MapPin className="size-3.5" />
              Office:{" "}
              {status?.office_assigned && status?.office
                ? status.office.name
                : "Not assigned — contact admin"}
            </p>
            {status?.office?.address ? (
              <p className="mt-0.5 text-[11px] text-slate-500">{status.office.address}</p>
            ) : null}
            <p className="mt-1 text-sm text-slate-700">
              {!status?.office_assigned ? (
                <span className="text-amber-700">Admin must assign your office before check-in.</span>
              ) : geoOk === true && geoDistance !== null ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="size-4" /> Within range ({geoDistance} m)
                </span>
              ) : geoOk === false && geoDistance !== null ? (
                <span className="text-red-600">Outside office range ({geoDistance} m)</span>
              ) : (
                "Location verified when you mark attendance"
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gap-2 bg-[#2B7CD3] hover:bg-[#256bb8]"
              disabled={busy || loading || !windowState.canCheckIn || !status?.office_assigned}
              onClick={() => void runMark("check_in")}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Check in
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={busy || loading || !windowState.canCheckOut || !status?.office_assigned}
              onClick={() => void runMark("check_out")}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Check out
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-slate-600"
              disabled={busy || loading}
              onClick={() => {
                void verifyLocation().then(() => toast.success("Location OK")).catch((e) => {
                  toast.error(e instanceof Error ? e.message : "Location check failed");
                });
              }}
            >
              <LocateFixed className="size-4" />
              Test location
            </Button>
          </div>

          {!avatarUrl ? (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Camera className="size-4 shrink-0" />
              Upload a clear profile photo under Account → Profile before marking attendance.
            </p>
          ) : null}
        </div>
      </div>

      <style>{`.mirror-video { transform: scaleX(-1); }`}</style>
    </Card>
  );
}
