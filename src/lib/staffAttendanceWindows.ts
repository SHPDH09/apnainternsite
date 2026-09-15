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

export function deriveStaffAttendanceWindow(input: {
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  istMinutes?: number;
}): StaffAttendanceWindowState {
  const istMinutes = input.istMinutes ?? istMinutesNow();
  const checkInStart = minutesFrom(STAFF_CHECK_IN_START.hour, STAFF_CHECK_IN_START.minute);
  const checkOutStart = minutesFrom(STAFF_CHECK_OUT_START.hour, STAFF_CHECK_OUT_START.minute);

  const canCheckIn =
    !input.hasCheckIn && istMinutes >= checkInStart && istMinutes < checkOutStart;
  const canCheckOut =
    input.hasCheckIn && !input.hasCheckOut && istMinutes >= checkOutStart;

  let message = "Attendance windows are closed for now.";
  if (input.hasCheckIn && input.hasCheckOut) {
    message = "Today's attendance is complete.";
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

  return {
    istMinutes,
    canCheckIn,
    canCheckOut,
    hasCheckIn: input.hasCheckIn,
    hasCheckOut: input.hasCheckOut,
    message,
  };
}
