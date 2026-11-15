import { describe, it, expect } from "vitest";
import { getSeed, URBAN_NEST } from "@/data/seed";
import { buildSceneData } from "@/lib/run/sceneData";

describe("3D scene data", () => {
  const sd = buildSceneData(getSeed(), URBAN_NEST, "2026-10", [86, 81, 31, 12]);
  it("one particle per raw enquiry, six merges", () => {
    expect(sd.particles.length).toBe(92);
    expect(sd.unique).toBe(86);
    expect(sd.merges).toBe(6);
    expect(sd.sources.reduce((a, s) => a + s.raw, 0)).toBe(92);
  });
  it("duplicates point at an existing unique particle and come from a different source", () => {
    for (const p of sd.particles.slice(86)) {
      expect(p.dupOf).not.toBeNull();
      expect(p.dupOf!).toBeLessThan(86);
      expect(sd.particles[p.dupOf!].source).not.toBe(p.source);
    }
  });
  it("stays well under the instance budget", () => expect(sd.particles.length).toBeLessThan(1500));
});
