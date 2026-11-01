import { describe, expect, it } from "vitest";
import type { Wall } from "~/types/domain";
import {
  clampOpeningOffset,
  nearestWall,
  nextOpeningId,
  nextWallId,
  placeDoor,
  pointPxToMm,
  projectOntoWall,
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

  it("projects points onto walls and picks the nearest wall within 300 mm", () => {
    const w01 = walls[0];
    if (!w01) throw new Error("fixture");
    expect(projectOntoWall([3000, 250], w01)).toEqual({
      along_mm: 3000,
      dist_mm: 250,
      side: "right", // y 아래가 + 이므로 a→b(동쪽) 의 오른쪽은 아래(남쪽)
    });
    expect(projectOntoWall([3000, -250], w01).side).toBe("left");
    expect(projectOntoWall([-300, 400], w01).dist_mm).toBe(500); // 끝점 a 까지
    expect(projectOntoWall([-300, 0], w01).along_mm).toBe(-300);
    expect(nearestWall([5000, 200], walls)?.id).toBe("w01");
    expect(nearestWall([9700, 3000], walls)?.id).toBe("w03");
    expect(nearestWall([5000, 3000], walls)).toBeNull();
  });

  it("places a door centred on the click, snapped and clamped into the wall", () => {
    const door = placeDoor([3004, 150], walls, [], 800);
    expect(door).toEqual({
      id: "o01",
      wall_id: "w01",
      offset_mm: 2600,
      width_mm: 800,
      height_mm: 2100,
      sill_mm: 0,
      type: "door",
      swing: { hinge: "a", side: "right" },
    });
    expect(placeDoor([9850, -100], walls, [], 800)?.offset_mm).toBe(9100);
    expect(placeDoor([100, -100], walls, [], 800)?.offset_mm).toBe(0);
    expect(placeDoor([5000, 3000], walls, [], 800)).toBeNull();
    expect(placeDoor([5000, 0], walls, [], 20000)).toBeNull();
    expect(
      nextOpeningId([
        { ...(door as NonNullable<typeof door>), id: "o07" },
        { ...(door as NonNullable<typeof door>), id: "x" },
      ]),
    ).toBe("o08");
    const w01 = walls[0];
    if (!w01) throw new Error("fixture");
    expect(clampOpeningOffset(w01, 1234, 800)).toBe(1230);
    expect(clampOpeningOffset(w01, 9500, 800)).toBe(9100);
    expect(clampOpeningOffset(w01, -50, 800)).toBe(0);
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
