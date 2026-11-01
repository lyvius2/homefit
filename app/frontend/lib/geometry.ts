// 회전된 사각형(OBB), 볼록 다각형, 여닫이문 열림 영역, SAT 교차 판정. 설계서 Section 3.
// Ruby 구현(app/lib/geometry/{obb,polygon,door_zone,sat}.rb)과 동작이 같아야 하며,
// docs/geometry-fixtures.json 의 같은 테스트 벡터로 검증한다.
//
// - 좌표계: 도면 좌상단 원점, x 오른쪽 +, y 아래 + (R-02)
// - 회전 deg: 위에서 봤을 때 시계방향. y 가 아래로 + 이므로 표준 회전행렬이 그대로 시계방향이다.
// - 꼭짓점 순서: (-hw,-hd), (+hw,-hd), (+hw,+hd), (-hw,+hd) 를 회전한 것.
import type { Opening, Wall } from "~/types/domain";

export const EPSILON = 1e-6;

export type Point = readonly [number, number];

/** 볼록 다각형. 꼭짓점은 둘레 순서 */
export interface Polygon {
  readonly corners: readonly Point[];
}

/** SAT 에 넣을 수 있는 도형: 꼭짓점과 분리축 후보 */
export interface Convex {
  corners(): readonly Point[];
  axes(): readonly Point[];
}

export interface Obb {
  readonly cx: number;
  readonly cy: number;
  readonly hw: number;
  readonly hd: number;
  readonly deg: number;
}

export interface Footprint {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation_deg: number;
}

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  thickness: number;
}

/** 집기 풋프린트: 중심 (x, y), 반폭 W/2, 반깊이 D/2, 회전 θ */
export function obbFromFootprint({
  x,
  y,
  width,
  depth,
  rotation_deg,
}: Footprint): Obb {
  return { cx: x, cy: y, hw: width / 2, hd: depth / 2, deg: rotation_deg };
}

/** 벽 풋프린트: 선분 a→b, 두께 t → 중심 (a+b)/2, 변 (L + t) × t, 회전 atan2(b−a) */
export function obbFromSegment({ ax, ay, bx, by, thickness }: Segment): Obb {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.sqrt(dx * dx + dy * dy);
  return {
    cx: (ax + bx) / 2,
    cy: (ay + by) / 2,
    hw: (length + thickness) / 2,
    hd: thickness / 2,
    deg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

function radians(obb: Obb): number {
  return (obb.deg * Math.PI) / 180;
}

export function obbCorners(obb: Obb): [Point, Point, Point, Point] {
  const cos = Math.cos(radians(obb));
  const sin = Math.sin(radians(obb));
  const { cx, cy, hw, hd } = obb;
  const local: [Point, Point, Point, Point] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return local.map(([lx, ly]): Point => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]) as [Point, Point, Point, Point];
}

/** SAT 분리축 후보: 변 방향 단위벡터 2개 */
export function obbAxes(obb: Obb): [Point, Point] {
  const cos = Math.cos(radians(obb));
  const sin = Math.sin(radians(obb));
  return [
    [cos, sin],
    [-sin, cos],
  ];
}

/** 다각형 각 변의 단위 법선 (SAT 분리축 후보) */
export function polygonAxes(polygon: Polygon): Point[] {
  const { corners } = polygon;
  return corners.map(([x1, y1], i) => {
    const [x2, y2] = corners[(i + 1) % corners.length] ?? [x1, y1];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const length = Math.sqrt(ex * ex + ey * ey);
    return [-ey / length, ex / length];
  });
}

export const DOOR_ZONE_SEGMENTS = 8;

/**
 * 여닫이문 열림 영역. 벽 단위벡터 u, 열리는 면의 법선 n(right = (-uy, ux), left = (uy, -ux)).
 * 경첩점 H = 개구부의 hinge 쪽 끝 + n·(t/2) (벽면 위), 열림 방향 d = hinge a ? u : -u.
 * 영역 = 중심 H, 반지름 width 의 90° 부채꼴(d → n)을 8등분한 볼록 다각형. 꼭짓점: H, 호 위 9점.
 * 문이 아니거나 swing 이 없거나 벽 길이가 0이면 null.
 */
export function doorZone(wall: Wall, opening: Opening): Polygon | null {
  const swing = opening.swing;
  if (opening.type !== "door" || !swing) return null;
  const [ax, ay] = wall.a;
  const dx = wall.b[0] - ax;
  const dy = wall.b[1] - ay;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;

  const ux = dx / length;
  const uy = dy / length;
  const [nx, ny] = swing.side === "right" ? [-uy, ux] : [uy, -ux];
  const radius = opening.width_mm;
  const hingeA = swing.hinge === "a";
  const along = opening.offset_mm + (hingeA ? 0 : radius);
  const halfT = wall.thickness_mm / 2;
  const hx = ax + ux * along + nx * halfT;
  const hy = ay + uy * along + ny * halfT;
  const [ddx, ddy] = hingeA ? [ux, uy] : [-ux, -uy];

  const corners: Point[] = [[hx, hy]];
  for (let k = 0; k <= DOOR_ZONE_SEGMENTS; k++) {
    const theta = (k * Math.PI) / 2 / DOOR_ZONE_SEGMENTS;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    corners.push([
      hx + radius * (cos * ddx + sin * nx),
      hy + radius * (cos * ddy + sin * ny),
    ]);
  }
  return { corners };
}

export function convexOfObb(obb: Obb): Convex {
  return { corners: () => obbCorners(obb), axes: () => obbAxes(obb) };
}

export function convexOfPolygon(polygon: Polygon): Convex {
  return { corners: () => polygon.corners, axes: () => polygonAxes(polygon) };
}

function project(corners: readonly Point[], [ux, uy]: Point): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const [x, y] of corners) {
    const value = x * ux + y * uy;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

/** 두 볼록 도형이 겹치면 true. 접촉(겹침 ≤ ε)은 false. */
export function convexIntersects(a: Convex, b: Convex): boolean {
  const cornersA = a.corners();
  const cornersB = b.corners();
  const axes = [...a.axes(), ...b.axes()];
  return axes.every((axis) => {
    const [minA, maxA] = project(cornersA, axis);
    const [minB, maxB] = project(cornersB, axis);
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    return overlap > EPSILON;
  });
}

/** 두 OBB 가 겹치면 true. 접촉(겹침 ≤ ε)은 false. */
export function satIntersects(a: Obb, b: Obb): boolean {
  return convexIntersects(convexOfObb(a), convexOfObb(b));
}
