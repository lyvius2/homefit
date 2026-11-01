// 도면 에디터의 순수 계산. 캔버스 "월드" 좌표는 이미지 px(이미지가 없으면 NO_IMAGE_PX_PER_MM 로 그린 px),
// 저장되는 벽 좌표는 정수 mm (R-01). 변환은 여기서만 한다.
import type { Opening, PlanVerify, Point, Wall } from "~/types/domain";

/** 도면 이미지가 없을 때 1 mm 를 몇 px 로 그릴지 (100 mm 격자 = 10 px) */
export const NO_IMAGE_PX_PER_MM = 0.1;
/** 벽 끝점에 붙는 스냅 거리 */
export const ENDPOINT_SNAP_MM = 150;
/** 벽 좌표 격자 */
export const GRID_SNAP_MM = 10;
/** 문 도구에서 클릭 지점과 벽 사이 허용 거리 */
export const DOOR_PICK_MM = 300;
/** 새 문의 기본 폭·높이 */
export const DOOR_WIDTH_MM = 800;
export const DOOR_HEIGHT_MM = 2100;

export interface Pt {
  x: number;
  y: number;
}

export function distance(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function wallLength(wall: Wall): number {
  return Math.round(Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]));
}

export function pxToMm(px: number, pxPerMm: number): number {
  return Math.round(px / pxPerMm);
}

export function mmToPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

export function pointPxToMm(p: Pt, pxPerMm: number): Point {
  return [pxToMm(p.x, pxPerMm), pxToMm(p.y, pxPerMm)];
}

export function snapToGrid(p: Point, step = GRID_SNAP_MM): Point {
  return [Math.round(p[0] / step) * step, Math.round(p[1] / step) * step];
}

/** 직각 스냅: a 에서 b 로 그을 때 더 긴 축으로 맞춘다 */
export function snapRightAngle(a: Point, b: Point): Point {
  const dx = Math.abs(b[0] - a[0]);
  const dy = Math.abs(b[1] - a[1]);
  return dx >= dy ? [b[0], a[1]] : [a[0], b[1]];
}

/** 기존 벽 끝점이 tolerance 안에 있으면 그 점으로 붙인다 */
export function snapToEndpoints(
  p: Point,
  walls: readonly Wall[],
  tolerance = ENDPOINT_SNAP_MM,
): Point {
  let best: Point | null = null;
  let bestDistance = tolerance;
  for (const wall of walls) {
    for (const end of [wall.a, wall.b]) {
      const d = Math.hypot(end[0] - p[0], end[1] - p[1]);
      if (d <= bestDistance) {
        best = end;
        bestDistance = d;
      }
    }
  }
  return best ?? p;
}

/** 축척: 이미지 위 두 점(px)과 실제 길이(mm) → px_per_mm (소수 6자리) */
export function scaleFromPoints(a: Pt, b: Pt, measured_mm: number): number {
  return Number((distance(a, b) / measured_mm).toFixed(6));
}

/** 검증 측정: 두 점(px) 사이가 몇 mm 로 계산되는지와 오차(%) */
export function verifyFromPoints(
  a: Pt,
  b: Pt,
  measured_mm: number,
  pxPerMm: number,
): PlanVerify {
  const got_mm = Math.round(distance(a, b) / pxPerMm);
  const error_pct = Number(
    (Math.abs(got_mm - measured_mm) * 100) / measured_mm,
  ).toFixed(2);
  return { measured_mm, got_mm, error_pct: Number(error_pct) };
}

function nextId(prefix: string, ids: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const max = ids.reduce((acc, id) => {
    const n = Number(pattern.exec(id)?.[1] ?? 0);
    return Math.max(acc, n);
  }, 0);
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

/** "w01", "w02", ... 비어 있는 다음 번호 */
export function nextWallId(walls: readonly Wall[]): string {
  return nextId(
    "w",
    walls.map((w) => w.id),
  );
}

/** "o01", "o02", ... 비어 있는 다음 번호 */
export function nextOpeningId(openings: readonly Opening[]): string {
  return nextId(
    "o",
    openings.map((o) => o.id),
  );
}

/**
 * 점을 벽 선분에 투영. along_mm 은 a 에서 투영점까지(선분 밖이면 음수·길이 초과 가능),
 * dist_mm 은 선분(끝점 포함)까지의 최단 거리, side 는 a→b 기준 점이 놓인 면.
 */
export function projectOntoWall(
  p: Point,
  wall: Wall,
): { along_mm: number; dist_mm: number; side: "left" | "right" } {
  const [ax, ay] = wall.a;
  const dx = wall.b[0] - ax;
  const dy = wall.b[1] - ay;
  const len2 = dx * dx + dy * dy;
  const px = p[0] - ax;
  const py = p[1] - ay;
  if (len2 === 0)
    return { along_mm: 0, dist_mm: Math.hypot(px, py), side: "left" };
  const t = (px * dx + py * dy) / len2;
  const tc = Math.min(1, Math.max(0, t));
  // y 가 아래로 + 인 평면에서 외적 > 0 이면 a→b 의 오른쪽 (설계서 Section 2.3 의 right 법선 (-uy, ux) 쪽)
  const cross = dx * py - dy * px;
  return {
    along_mm: t * Math.sqrt(len2),
    dist_mm: Math.hypot(px - dx * tc, py - dy * tc),
    side: cross > 0 ? "right" : "left",
  };
}

/** 점에서 maxDist 안에 있는 가장 가까운 벽. 없으면 null */
export function nearestWall(
  p: Point,
  walls: readonly Wall[],
  maxDist = DOOR_PICK_MM,
): Wall | null {
  let best: Wall | null = null;
  let bestDistance = maxDist;
  for (const wall of walls) {
    const { dist_mm } = projectOntoWall(p, wall);
    if (dist_mm <= bestDistance) {
      best = wall;
      bestDistance = dist_mm;
    }
  }
  return best;
}

/** offset 을 10 mm 격자에 맞추고 [0, 벽 길이 − 폭] 으로 묶는다 */
export function clampOpeningOffset(
  wall: Wall,
  offset_mm: number,
  width_mm: number,
): number {
  const max = Math.max(0, wallLength(wall) - width_mm);
  const snapped = Math.round(offset_mm / GRID_SNAP_MM) * GRID_SNAP_MM;
  return Math.min(max, Math.max(0, snapped));
}

/**
 * 문 도구 클릭: 가까운 벽에 클릭 지점을 중심으로 폭 width_mm 의 여닫이문을 놓는다.
 * 열리는 면은 클릭한 쪽, 경첩은 a 쪽(사이드바에서 반전). 벽이 멀거나 문보다 짧으면 null.
 */
export function placeDoor(
  point: Point,
  walls: readonly Wall[],
  openings: readonly Opening[],
  width_mm: number,
): Opening | null {
  const wall = nearestWall(point, walls);
  if (!wall || width_mm > wallLength(wall)) return null;
  const { along_mm, side } = projectOntoWall(point, wall);
  return {
    id: nextOpeningId(openings),
    wall_id: wall.id,
    offset_mm: clampOpeningOffset(wall, along_mm - width_mm / 2, width_mm),
    width_mm,
    height_mm: DOOR_HEIGHT_MM,
    sill_mm: 0,
    type: "door",
    swing: { hinge: "a", side },
  };
}

/** 휠 줌: 포인터 아래 점을 고정한 채 스케일을 바꾼 뒤의 stage 위치 */
export function zoomAt(
  pointer: Pt,
  stage: { x: number; y: number; scale: number },
  direction: 1 | -1,
  factor = 1.1,
  min = 0.05,
  max = 20,
): { x: number; y: number; scale: number } {
  const next = Math.min(
    max,
    Math.max(min, direction > 0 ? stage.scale * factor : stage.scale / factor),
  );
  const worldX = (pointer.x - stage.x) / stage.scale;
  const worldY = (pointer.y - stage.y) / stage.scale;
  return {
    scale: next,
    x: pointer.x - worldX * next,
    y: pointer.y - worldY * next,
  };
}
