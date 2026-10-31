import { describe, expect, it } from "vitest";
import type { Wall } from "~/types/domain";
import {
  nextWallId,
  pointPxToMm,
  scaleFromPoints,
  snapRightAngle,
  snapToEndpoints,
  snapToGrid,
  verifyFromPoints,
  wallLength,
  zoomAt,
} from "./planMath";

const walls: Wall[] = [
  { id: "w01", a: [0, 0], b: [9900, 0], thickness_mm: 200 },
  { id: "w03", a: [9900, 0], b: [9900, 6300], thickness_mm: 200 },
];

describe("planMath", () => {
  it("converts px to integer mm", () => {
    expect(pointPxToMm({ x: 123.4, y: 567.8 }, 0.1)).toEqual([1234, 5678]);
    expect(pointPxToMm({ x: 10, y: 10 }, 0.25)).toEqual([40, 40]);
  });

  it("snaps to 10 mm grid, right angles and nearby endpoints", () => {
    expect(snapToGrid([1234, 5678])).toEqual([1230, 5680]);
    expect(snapRightAngle([0, 0], [900, 100])).toEqual([900, 0]);
    expect(snapRightAngle([0, 0], [100, 900])).toEqual([0, 900]);
    expect(snapToEndpoints([9800, 60], walls)).toEqual([9900, 0]);
    expect(snapToEndpoints([5000, 60], walls)).toEqual([5000, 60]);
  });

  it("measures wall length and numbers new walls after the highest id", () => {
    expect(
      wallLength({ id: "x", a: [0, 0], b: [3000, 4000], thickness_mm: 100 }),
    ).toBe(5000);
    expect(nextWallId(walls)).toBe("w04");
    expect(nextWallId([])).toBe("w01");
  });

  it("derives scale and verify from two points", () => {
    expect(scaleFromPoints({ x: 0, y: 0 }, { x: 360, y: 0 }, 3600)).toBe(0.1);
    const verify = verifyFromPoints(
      { x: 100, y: 0 },
      { x: 346, y: 0 },
      2400,
      0.1,
    );
    expect(verify).toEqual({ measured_mm: 2400, got_mm: 2460, error_pct: 2.5 });
  });

  it("zooms around the pointer and clamps the scale", () => {
    const next = zoomAt({ x: 100, y: 100 }, { x: 0, y: 0, scale: 1 }, 1);
    expect(next.scale).toBeCloseTo(1.1);
    // 포인터 아래 월드 좌표 (100,100) 이 그대로 유지된다
    expect((100 - next.x) / next.scale).toBeCloseTo(100);
    expect(zoomAt({ x: 0, y: 0 }, { x: 0, y: 0, scale: 20 }, 1).scale).toBe(20);
  });
});
