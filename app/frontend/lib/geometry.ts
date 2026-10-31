// 회전된 사각형(OBB)과 SAT 교차 판정. 설계서 Section 3.
// Ruby 구현(app/lib/geometry/{obb,sat}.rb)과 동작이 같아야 하며,
// docs/geometry-fixtures.json 의 같은 테스트 벡터로 검증한다.
//
// - 좌표계: 도면 좌상단 원점, x 오른쪽 +, y 아래 + (R-02)
// - 회전 deg: 위에서 봤을 때 시계방향. y 가 아래로 + 이므로 표준 회전행렬이 그대로 시계방향이다.
// - 꼭짓점 순서: (-hw,-hd), (+hw,-hd), (+hw,+hd), (-hw,+hd) 를 회전한 것.

export const EPSILON = 1e-6;

export type Point = readonly [number, number];

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

/** 두 OBB 가 겹치면 true. 접촉(겹침 ≤ ε)은 false. */
export function satIntersects(a: Obb, b: Obb): boolean {
  const cornersA = obbCorners(a);
  const cornersB = obbCorners(b);
  const axes = [...obbAxes(a), ...obbAxes(b)];
  return axes.every((axis) => {
    const [minA, maxA] = project(cornersA, axis);
    const [minB, maxB] = project(cornersB, axis);
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    return overlap > EPSILON;
  });
}
