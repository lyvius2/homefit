// 도면 에디터의 순수 계산. 캔버스 "월드" 좌표는 이미지 px(이미지가 없으면 NO_IMAGE_PX_PER_MM 로 그린 px),
// 저장되는 벽 좌표는 정수 mm (R-01). 변환은 여기서만 한다.
import type { PlanVerify, Point, Wall } from "~/types/domain";

/** 도면 이미지가 없을 때 1 mm 를 몇 px 로 그릴지 (100 mm 격자 = 10 px) */
export const NO_IMAGE_PX_PER_MM = 0.1;
/** 벽 끝점에 붙는 스냅 거리 */
export const ENDPOINT_SNAP_MM = 150;
/** 벽 좌표 격자 */
export const GRID_SNAP_MM = 10;

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

/** "w01", "w02", ... 비어 있는 다음 번호 */
export function nextWallId(walls: readonly Wall[]): string {
  const max = walls.reduce((acc, w) => {
    const n = Number(/^w(\d+)$/.exec(w.id)?.[1] ?? 0);
    return Math.max(acc, n);
  }, 0);
  return `w${String(max + 1).padStart(2, "0")}`;
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
