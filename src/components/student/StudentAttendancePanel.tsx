import { useMemo } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  Fingerprint,
  ShieldCheck,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ATTENDANCE_ELIGIBILITY_MIN_PERCENT,
  minDaysForAttendanceEligibility,
} from "@/lib/attendanceStats";

export type AttendanceRecord = {
  id: string;
  marked_at: string;
  is_present?: boolean | null;
};

export type AttendanceStats = {
  total: number;
  percentage: number;
  attendanceTotalDays: number;
  isEligible: boolean;
};

type Props = {
  attendanceList: AttendanceRecord[];
  stats: AttendanceStats;
  attendanceMarkedToday: boolean;
  canMarkAttendanceToday: boolean;
  markingBlocked: boolean;
  holdProgress: number;
  isHolding: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
};

const HOLD_RING_R = 72;
const HOLD_RING_C = 2 * Math.PI * HOLD_RING_R;

function formatRecordDate(markedAt: string) {
  return new Date(markedAt).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRecordTime(markedAt: string) {
  return new Date(markedAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function StudentAttendancePanel({
  attendanceList,
  stats,
  attendanceMarkedToday,
  canMarkAttendanceToday,
  markingBlocked,
  holdProgress,
  isHolding,
  onHoldStart,
  onHoldEnd,
}: Props) {
  const minDays = minDaysForAttendanceEligibility(ATTENDANCE_ELIGIBILITY_MIN_PERCENT, stats.attendanceTotalDays);
  const daysToGoal = Math.max(0, minDays - stats.total);
  const eligibilityProgress = Math.min(100, (stats.total / minDays) * 100);

  const ringStroke = attendanceMarkedToday
    ? "#10b981"
    : !canMarkAttendanceToday
      ? "#94a3b8"
      : "#5aa3e6";

  const statusCopy = useMemo(() => {
    if (attendanceMarkedToday) {
      return {
        title: "Verified for today",
        detail: "Your attendance has been recorded for this calendar day.",
      };
    }
    if (markingBlocked) {
      return {
        title: "Self-marking closed",
        detail: "Attendance marking is no longer available for your university.",
      };
    }
    return {
      title: "Hold to mark attendance",
      detail: "Press and hold for 10 seconds — once per calendar day.",
    };
  }, [attendanceMarkedToday, markingBlocked]);

  return (
    <div id="attendance-section" className="mt-10 mb-10 student-dash-animate-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <CheckSquare className="size-5 text-[#5aa3e6]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Daily attendance</h2>
            <p className="text-sm text-slate-500">Secure hold-to-verify · {todayLabel()}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`font-medium ${
              stats.isEligible
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <ShieldCheck className="mr-1 size-3.5" />
            {stats.isEligible ? "Eligible" : `${ATTENDANCE_ELIGIBILITY_MIN_PERCENT}% required`}
          </Badge>
          <Badge variant="outline" className="font-medium text-slate-600">
            {attendanceList.length} days recorded
          </Badge>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="student-stat-tile flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#5aa3e6]/10">
            <CalendarDays className="size-4 text-[#3b82c4]" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total days</p>
            <p className="text-xl font-semibold tabular-nums text-slate-900">
              {stats.total}
              <span className="text-sm font-normal text-slate-400"> / {stats.attendanceTotalDays}</span>
            </p>
          </div>
        </div>
        <div className="student-stat-tile flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance rate</p>
            <p className={`text-xl font-semibold tabular-nums ${stats.isEligible ? "text-emerald-700" : "text-amber-700"}`}>
              {stats.percentage.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="student-stat-tile flex items-center gap-3">
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${
              attendanceMarkedToday ? "bg-emerald-500/10" : "bg-slate-200/80"
            }`}
          >
            {attendanceMarkedToday ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <XCircle className="size-4 text-slate-400" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today</p>
            <p className={`text-xl font-semibold ${attendanceMarkedToday ? "text-emerald-700" : "text-slate-600"}`}>
              {attendanceMarkedToday ? "Present" : "Not marked"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="student-dash-card p-6 lg:col-span-2">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl student-dash-hero-accent text-white shadow-sm">
              <Fingerprint className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{statusCopy.title}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{statusCopy.detail}</p>
            </div>
          </div>

          <div className="flex flex-col items-center py-2">
            <div
              className={`attendance-hold-shell relative flex items-center justify-center select-none ${
                isHolding ? "attendance-hold-active" : ""
              }`}
            >
              <svg
                className="absolute pointer-events-none"
                width="176"
                height="176"
                style={{ transform: "rotate(-90deg)" }}
                aria-hidden
              >
                <circle cx="88" cy="88" r={HOLD_RING_R} fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                  cx="88"
                  cy="88"
                  r={HOLD_RING_R}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth="8"
                  strokeDasharray={HOLD_RING_C}
                  strokeDashoffset={HOLD_RING_C * (1 - holdProgress / 100)}
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-75 ease-linear"
                />
              </svg>

              <button
                type="button"
                className={`attendance-hold-btn relative z-10 flex size-36 flex-col items-center justify-center gap-1 rounded-full border-4 font-semibold transition-all select-none touch-none ${
                  attendanceMarkedToday
                    ? "cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700"
                    : !canMarkAttendanceToday
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      : isHolding
                        ? "border-[#5aa3e6] bg-[#5aa3e6] text-white shadow-lg scale-[0.97]"
                        : "border-slate-200 bg-white text-slate-800 shadow-md hover:border-[#5aa3e6]/40 hover:shadow-lg active:scale-[0.98]"
                }`}
                onMouseDown={onHoldStart}
                onMouseUp={onHoldEnd}
                onMouseLeave={onHoldEnd}
                onTouchStart={onHoldStart}
                onTouchEnd={onHoldEnd}
                disabled={!canMarkAttendanceToday}
                aria-label={
                  attendanceMarkedToday
                    ? "Attendance already marked today"
                    : "Hold for 10 seconds to mark attendance"
                }
              >
                {attendanceMarkedToday ? (
                  <div className="flex flex-col items-center animate-in zoom-in duration-300">
                    <CheckCircle2 className="mb-1 size-10" />
                    <span className="text-xs uppercase tracking-wider">Verified</span>
                  </div>
                ) : isHolding ? (
                  <>
                    <span className="text-3xl font-bold tabular-nums">{Math.round(holdProgress)}%</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-90">Verifying…</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="mb-1 size-9 text-[#5aa3e6]" />
                    <span className="text-sm font-semibold uppercase tracking-wide">Hold</span>
                    <span className="text-[10px] font-medium text-slate-500">10 seconds</span>
                  </>
                )}
              </button>
            </div>

            {canMarkAttendanceToday && !attendanceMarkedToday && (
              <p className="mt-4 text-center text-xs text-slate-400">
                Release before completion to cancel
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-3">
          <div className="student-dash-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-[#5aa3e6]" />
                <h3 className="text-sm font-semibold text-slate-900">Eligibility progress</h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {stats.total} / {minDays} days for {ATTENDANCE_ELIGIBILITY_MIN_PERCENT}%
              </span>
            </div>
            <Progress value={eligibilityProgress} className="h-2.5 bg-slate-100" />
            <p className="mt-3 text-sm text-slate-600">
              {stats.isEligible ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="size-4 shrink-0" />
                  You meet the minimum attendance requirement for certificate eligibility.
                </span>
              ) : (
                <span>
                  Mark <strong className="font-semibold text-slate-800">{daysToGoal}</strong> more day
                  {daysToGoal === 1 ? "" : "s"} to reach {ATTENDANCE_ELIGIBILITY_MIN_PERCENT}% (
                  {minDays} of {stats.attendanceTotalDays} programme days).
                </span>
              )}
            </p>
          </div>

          <div className="student-dash-card flex min-h-[280px] flex-col p-6">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="size-4 text-[#5aa3e6]" />
              <h3 className="text-sm font-semibold text-slate-900">Attendance history</h3>
            </div>

            {attendanceList.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-slate-100">
                  <CheckSquare className="size-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">No attendance records yet</p>
                <p className="mt-1 text-xs text-slate-400">Your verified days will appear here</p>
              </div>
            ) : (
              <ScrollArea className="flex-1 max-h-[320px] pr-1">
                <div className="attendance-timeline space-y-0">
                  {attendanceList.map((rec, idx) => (
                    <div key={rec.id} className="attendance-timeline-item relative flex gap-4 pb-5 last:pb-0">
                      <div className="relative flex flex-col items-center">
                        <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        </div>
                        {idx < attendanceList.length - 1 && (
                          <div className="absolute top-8 h-[calc(100%+4px)] w-px bg-slate-200" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 transition-colors hover:border-slate-200 hover:bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{formatRecordDate(rec.marked_at)}</p>
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700"
                          >
                            Present
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{formatRecordTime(rec.marked_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
