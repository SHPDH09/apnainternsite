/** IST time windows for staff geo + face attendance. */

export const STAFF_CHECK_IN_START = { hour: 10, minute: 0 }; // 10:00 AM
export const STAFF_CHECK_OUT_START = { hour: 18, minute: 0 }; // 6:00 PM

export type StaffAttendanceWindowState = {
  istMinutes: number;
  canCheckIn: boolean;
  canCheckOut: boolean;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  message: string;
};

export function istMinutesNow(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function minutesFrom(hour: number, minute: number) {
  return hour * 60 + minute;
}

function parseHalfDayMinutes(label?: string): number | null {
  if (!label) return null;
  const m = label.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function deriveStaffAttendanceWindow(input: {
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  istMinutes?: number;
  halfDayMode?: boolean;
  halfDayFrom?: string;
  halfDayUntil?: string;
  canCheckInFromServer?: boolean;
  canCheckOutFromServer?: boolean;
  serverMessage?: string | null;
}): StaffAttendanceWindowState {
  const istMinutes = input.istMinutes ?? istMinutesNow();
  const checkInStart = minutesFrom(STAFF_CHECK_IN_START.hour, STAFF_CHECK_IN_START.minute);
  const checkOutStart = minutesFrom(STAFF_CHECK_OUT_START.hour, STAFF_CHECK_OUT_START.minute);

  const halfFrom = input.halfDayMode ? parseHalfDayMinutes(input.halfDayFrom) : null;
  const halfUntil = input.halfDayMode ? parseHalfDayMinutes(input.halfDayUntil) : null;

  let canCheckIn: boolean;
  let canCheckOut: boolean;

  if (input.halfDayMode && halfFrom != null && halfUntil != null) {
    canCheckIn =
      typeof input.canCheckInFromServer === "boolean"
        ? input.canCheckInFromServer
        : !input.hasCheckIn && istMinutes >= halfFrom && istMinutes < halfUntil;
    canCheckOut =
      typeof input.canCheckOutFromServer === "boolean"
        ? input.canCheckOutFromServer
        : input.hasCheckIn && !input.hasCheckOut;
  } else {
    canCheckIn =
      typeof input.canCheckInFromServer === "boolean"
        ? input.canCheckInFromServer
        : !input.hasCheckIn && istMinutes >= checkInStart && istMinutes < checkOutStart;
    canCheckOut =
      typeof input.canCheckOutFromServer === "boolean"
        ? input.canCheckOutFromServer
        : input.hasCheckIn && !input.hasCheckOut && istMinutes >= checkOutStart;
  }

  let message = input.serverMessage?.trim() || "Attendance windows are closed for now.";
  if (!input.serverMessage) {
    if (input.hasCheckIn && input.hasCheckOut) {
      message = "Today's attendance is complete.";
    } else if (input.halfDayMode && halfFrom != null && halfUntil != null) {
      if (!input.hasCheckIn && istMinutes < halfFrom) {
        message = `Half-day check-in opens at ${input.halfDayFrom} IST.`;
      } else if (!input.hasCheckIn && istMinutes >= halfUntil) {
        message = `Half-day check-in window closed (${input.halfDayFrom}–${input.halfDayUntil} IST).`;
      } else if (canCheckIn) {
        message = `Half-day check-in open until ${input.halfDayUntil} IST.`;
      } else if (input.hasCheckIn && !input.hasCheckOut) {
        message = "Checked in for half day. You can check out now.";
      }
    } else if (canCheckIn) {
      message = "Check-in is open (10:00 AM – 6:00 PM IST). Face + location required.";
    } else if (input.hasCheckIn && istMinutes < checkOutStart) {
      message = "Checked in. Check-out opens at 6:00 PM IST.";
    } else if (canCheckOut) {
      message = "Check-out is open. Face + location required.";
    } else if (!input.hasCheckIn && istMinutes < checkInStart) {
      message = "Check-in opens at 10:00 AM IST.";
    } else if (!input.hasCheckIn && istMinutes >= checkOutStart) {
      message = "Check-in window closed for today.";
    }
  }

  return {
    istMinutes,
    canCheckIn,
    canCheckOut,
    hasCheckIn: input.hasCheckIn,
    hasCheckOut: input.hasCheckOut,
    message,
  };
}
