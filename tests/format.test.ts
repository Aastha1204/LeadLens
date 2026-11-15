import { describe, it, expect } from "vitest";
import { inr, inrShort, minutesLabel } from "@/lib/format";

describe("formatting", () => {
  it("uses en-IN grouping", () => expect(inr(3680000)).toBe("₹36,80,000"));
  it("short form", () => {
    expect(inrShort(3680000)).toBe("₹36.8L");
    expect(inrShort(3800000)).toBe("₹38L");
  });
  it("minutes label", () => {
    expect(minutesLabel(125)).toBe("2h 05m");
    expect(minutesLabel(9)).toBe("9 min");
  });
});
