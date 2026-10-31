import { describe, expect, it } from "vitest";
import {
  normalizeDeg,
  planToScene,
  rotationDegToSceneY,
  sceneToPlan,
  snapMm,
} from "./coords";

describe("coords", () => {
  it("maps plan mm to scene meters with y_mm on the z axis and height on y", () => {
    expect(planToScene(9900, 6300)).toEqual([9.9, 0, 6.3]);
    expect(planToScene(1000, 2000, 500)).toEqual([1, 0.5, 2]);
  });

  it("round-trips scene floor coordinates back to integer mm", () => {
    const [x, , z] = planToScene(1234, 5678);
    expect(sceneToPlan(x, z)).toEqual([1234, 5678]);
    expect(sceneToPlan(0.00049, 0.0005)).toEqual([0, 1]);
  });

  it("converts clockwise degrees to a negative y rotation", () => {
    expect(rotationDegToSceneY(90)).toBeCloseTo(-Math.PI / 2);
    expect(rotationDegToSceneY(0)).toBe(-0);
  });

  it("normalizes degrees to 0–359 and snaps to 10 mm", () => {
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(45.6)).toBe(46);
    expect(snapMm(1234)).toBe(1230);
    expect(snapMm(1235)).toBe(1240);
    expect(snapMm(1234, 100)).toBe(1200);
  });
});
