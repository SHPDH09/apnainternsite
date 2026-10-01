import { describe, expect, it } from "vitest";
import { parseSpokenDate } from "@/lib/parseSpokenDate";

describe("parseSpokenDate", () => {
  const ref = new Date("2026-10-01T12:00:00Z");

  it("parses day + month name", () => {
    expect(parseSpokenDate("10 October 2005", { referenceDate: ref })).toBe("2005-10-10");
    expect(parseSpokenDate("5 September", { referenceDate: ref })).toBe("2026-09-05");
  });

  it("parses dotted numeric dates", () => {
    expect(parseSpokenDate("5.5.2026", { referenceDate: ref })).toBe("2026-05-05");
    expect(parseSpokenDate("05/09/2020", { referenceDate: ref })).toBe("2020-09-05");
  });

  it("parses phrases with extra words", () => {
    expect(parseSpokenDate("my date of birth is 10 october 2004", { referenceDate: ref })).toBe(
      "2004-10-10"
    );
  });
});
