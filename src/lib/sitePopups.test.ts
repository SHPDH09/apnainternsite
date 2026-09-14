/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  isPopupInSchedule,
  isPopupLiveForLocation,
  popupTargetsPage,
  resolvePopupPageKeys,
} from "./sitePopups";

describe("site popups", () => {
  it("maps routes to page keys", () => {
    expect(resolvePopupPageKeys("/")).toEqual(["home"]);
    expect(resolvePopupPageKeys("/", "#about")).toEqual(["about"]);
    expect(resolvePopupPageKeys("/login")).toEqual(["login"]);
    expect(resolvePopupPageKeys("/admin/login")).toEqual(["admin_login"]);
    expect(resolvePopupPageKeys("/register")).toEqual(["registration"]);
    expect(resolvePopupPageKeys("/dashboard")).toEqual(["dashboard"]);
    expect(resolvePopupPageKeys("/contact")).toEqual(["contact"]);
  });

  it("treats all-pages as a match", () => {
    expect(popupTargetsPage(["all"], ["home"])).toBe(true);
    expect(popupTargetsPage(["login"], ["home"])).toBe(false);
    expect(popupTargetsPage(["home", "contact"], ["contact"])).toBe(true);
  });

  it("respects start and end schedule", () => {
    const now = new Date("2026-08-13T10:00:00.000Z");
    expect(isPopupInSchedule({ start_at: "2026-08-13T09:00:00.000Z", end_at: "2026-08-13T11:00:00.000Z" }, now)).toBe(true);
    expect(isPopupInSchedule({ start_at: "2026-08-13T11:00:00.000Z", end_at: null }, now)).toBe(false);
    expect(isPopupInSchedule({ start_at: null, end_at: "2026-08-13T09:00:00.000Z" }, now)).toBe(false);
  });

  it("does not show on admin dashboard even for all pages", () => {
    const popup = {
      is_active: true,
      pages: ["all"],
      start_at: null,
      end_at: null,
    };
    expect(isPopupLiveForLocation(popup, "/")).toBe(true);
    expect(isPopupLiveForLocation(popup, "/admin")).toBe(false);
    expect(isPopupLiveForLocation(popup, "/admin/login")).toBe(true);
  });
});
