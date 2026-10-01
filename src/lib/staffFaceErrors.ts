/** Map server / face-api errors to clear messages (camera may still be working). */
export function humanizeStaffFaceError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "Request failed");
  const lower = msg.toLowerCase();

  if (/access denied|accessdenied|403/.test(lower)) {
    return "Photo save failed on server (not a camera problem). Refresh and try again — if it persists, contact admin.";
  }
  if (/camera is not ready/i.test(msg)) {
    return "Wait a second for the video to start, then tap Register again.";
  }
  if (/no face detected/i.test(msg)) {
    return "Camera is on, but we could not detect your face. Face the camera, remove mask/cap, use brighter light, and retry.";
  }
  if (/profile not loaded/i.test(msg)) {
    return "Your staff profile is still loading. Refresh the page and try again.";
  }
  if (/staff profile not found/i.test(msg)) {
    return "No staff record linked to your login. Ask admin to add you in Staff Management with this email.";
  }
  if (/staff role required/i.test(msg)) {
    return "Your account does not have the staff role. Ask admin to enable staff access.";
  }
  if (/face is already registered/i.test(msg)) {
    return "Face is already registered on your account. You can mark check-in/check-out now.";
  }
  if (/invalid face data/i.test(msg)) {
    return "Face data was incomplete. Look at the camera and tap Register again.";
  }
  if (/getusermedia|notallowed|permission|denied.*camera|camera.*denied/i.test(lower)) {
    return "Browser blocked the camera. Allow camera permission for this site in browser settings and reload.";
  }

  return msg;
}
