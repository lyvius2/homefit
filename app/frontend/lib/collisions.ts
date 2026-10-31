// 집기 풋프린트 간 겹침, 벽 침범, 외곽 이탈 판정 (설계서 Section 3, R-08).
// Ruby 구현(app/lib/geometry/{bounds,collisions}.rb)과 같은 테스트 벡터(docs/geometry-fixtures.json)로 검증한다.
import type { PlacementViolation, Wall } from "~/types/domain";
import {
  obbCorners,
  obbFromFootprint,
  obbFromSegment,
  satIntersects,
  type Obb,
} from "./geometry";

export interface Footprint {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation_deg: number;
}

export interface Bounds {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

export const OUT_OF_BOUNDS_TOLERANCE_MM = 1;

/** 벽 끝점 ± 두께/2 를 정수 mm 로 감싼 외곽. 벽이 없으면 null. */
export function boundsOfWalls(walls: readonly Wall[]): Bounds | null {
  if (walls.length === 0) return null;
  let min_x = Number.POSITIVE_INFINITY;
  let min_y = Number.POSITIVE_INFINITY;
  let max_x = Number.NEGATIVE_INFINITY;
  let max_y = Number.NEGATIVE_INFINITY;
  for (const wall of walls) {
    const half = wall.thickness_mm / 2;
    for (const [x, y] of [wall.a, wall.b]) {
      min_x = Math.min(min_x, x - half);
      min_y = Math.min(min_y, y - half);
      max_x = Math.max(max_x, x + half);
      max_y = Math.max(max_y, y + half);
    }
  }
  return {
    min_x: Math.floor(min_x),
    min_y: Math.floor(min_y),
    max_x: Math.ceil(max_x),
    max_y: Math.ceil(max_y),
  };
}

function outside(box: Obb, bounds: Bounds): boolean {
  const t = OUT_OF_BOUNDS_TOLERANCE_MM;
  return obbCorners(box).some(
    ([x, y]) =>
      x < bounds.min_x - t ||
      x > bounds.max_x + t ||
      y < bounds.min_y - t ||
      y > bounds.max_y + t,
  );
}

/** 위반이 있는 배치만, index 오름차순. reasons 순서: overlap(상대 index 오름차순) → wall(벽 순서) → out_of_bounds */
export function checkCollisions(
  walls: readonly Wall[],
  footprints: readonly Footprint[],
): PlacementViolation[] {
  const boxes = footprints.map(obbFromFootprint);
  const wallBoxes = walls.map((w) => ({
    id: w.id,
    box: obbFromSegment({
      ax: w.a[0],
      ay: w.a[1],
      bx: w.b[0],
      by: w.b[1],
      thickness: w.thickness_mm,
    }),
  }));
  const bounds = boundsOfWalls(walls);

  const violations: PlacementViolation[] = [];
  boxes.forEach((box, i) => {
    const reasons: string[] = [];
    boxes.forEach((other, j) => {
      if (i !== j && satIntersects(box, other)) reasons.push(`overlap:${j}`);
    });
    for (const wall of wallBoxes) {
      if (satIntersects(box, wall.box)) reasons.push(`wall:${wall.id}`);
    }
    if (bounds && outside(box, bounds)) reasons.push("out_of_bounds");
    if (reasons.length > 0) violations.push({ placement_index: i, reasons });
  });
  return violations;
}
