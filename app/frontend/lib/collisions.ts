// 집기 풋프린트 간 겹침, 벽 침범, 문 열림 영역 침범, 외곽 이탈 판정 (설계서 Section 3, R-08).
// Ruby 구현(app/lib/geometry/{bounds,collisions}.rb)과 같은 테스트 벡터(docs/geometry-fixtures.json)로 검증한다.
import type { Opening, PlacementViolation, Wall } from "~/types/domain";
import {
  EPSILON,
  convexIntersects,
  convexOfObb,
  convexOfPolygon,
  doorZone,
  obbCorners,
  obbFromFootprint,
  obbFromSegment,
  satIntersects,
  type Obb,
  type Polygon,
} from "./geometry";

export interface Footprint {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation_deg: number;
  /** 바닥에서 띄운 높이(mm). 생략 시 0 */
  z?: number;
  /** 집기 높이(mm). 생략 시 무한(높이를 모르는 옛 벡터) */
  height?: number;
}

type Span = readonly [number, number];

function verticalSpan(f: Footprint): Span {
  const bottom = f.z ?? 0;
  return [
    bottom,
    f.height === undefined ? Number.POSITIVE_INFINITY : bottom + f.height,
  ];
}

/** 접촉(책상 윗면 = 모니터 바닥)은 겹침이 아니다 */
function spansOverlap(a: Span, b: Span): boolean {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > EPSILON;
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

/** 영역이 있는 문만, openings 순서대로 */
export function doorZonesOf(
  walls: readonly Wall[],
  openings: readonly Opening[],
): { id: string; zone: Polygon }[] {
  const byId = new Map(walls.map((w) => [w.id, w]));
  const zones: { id: string; zone: Polygon }[] = [];
  for (const opening of openings) {
    const wall = byId.get(opening.wall_id);
    if (!wall) continue;
    const zone = doorZone(wall, opening);
    if (zone) zones.push({ id: opening.id, zone });
  }
  return zones;
}

/**
 * 위반이 있는 배치만, index 오름차순. reasons 순서: overlap(상대 index 오름차순) → wall(벽 순서) → door(개구부 순서) → out_of_bounds.
 * 집기끼리는 평면 SAT 에 더해 수직 구간 [z, z+height] 도 겹쳐야 겹침(책상 위 모니터). 문 열림 영역은 문짝이 지나는
 * [sill, sill+height] 와 수직으로 겹칠 때만 침범(문 위 선반). 벽은 바닥부터 천장까지라 평면만 본다.
 */
export function checkCollisions(
  walls: readonly Wall[],
  footprints: readonly Footprint[],
  openings: readonly Opening[] = [],
): PlacementViolation[] {
  const boxes = footprints.map(obbFromFootprint);
  const spans = footprints.map(verticalSpan);
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
  const openingById = new Map(openings.map((o) => [o.id, o]));
  const doorZones = doorZonesOf(walls, openings).map(({ id, zone }) => {
    const o = openingById.get(id);
    const sill = o?.sill_mm ?? 0;
    const span: Span = [sill, sill + (o?.height_mm ?? 0)];
    return { id, convex: convexOfPolygon(zone), span };
  });
  const bounds = boundsOfWalls(walls);

  const violations: PlacementViolation[] = [];
  boxes.forEach((box, i) => {
    const reasons: string[] = [];
    const span = spans[i] ?? [0, Number.POSITIVE_INFINITY];
    boxes.forEach((other, j) => {
      const otherSpan = spans[j] ?? [0, Number.POSITIVE_INFINITY];
      if (i !== j && spansOverlap(span, otherSpan) && satIntersects(box, other))
        reasons.push(`overlap:${j}`);
    });
    for (const wall of wallBoxes) {
      if (satIntersects(box, wall.box)) reasons.push(`wall:${wall.id}`);
    }
    const convex = convexOfObb(box);
    for (const door of doorZones) {
      if (
        spansOverlap(span, door.span) &&
        convexIntersects(convex, door.convex)
      )
        reasons.push(`door:${door.id}`);
    }
    if (bounds && outside(box, bounds)) reasons.push("out_of_bounds");
    if (reasons.length > 0) violations.push({ placement_index: i, reasons });
  });
  return violations;
}
