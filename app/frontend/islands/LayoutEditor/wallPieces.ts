// 벽 박스에서 개구부를 뺀 조각 계산 (순수 함수, Scene.tsx 의 WallMesh 가 쓴다).
import { mmToUnit } from "~/lib/coords";
import type { Opening, Wall } from "~/types/domain";

export interface WallPiece {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * 벽 로컬 x(중심 기준, a 가 −L/2) 를 따라 개구부를 뺀 조각들. 끝단은 t/2 연장(설계서 Section 3).
 * 개구부 사이는 전고, 개구부 위는 상인방(sill+height → 천장), 창 아래는 0 → sill. 단위 m.
 */
export function wallPieces(
  wall: Wall,
  openings: readonly Opening[],
  ceiling: number,
): WallPiece[] {
  const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const half = mmToUnit(length) / 2;
  const cap = mmToUnit(wall.thickness_mm) / 2;
  const pieces: WallPiece[] = [];
  let cursor = -half - cap;
  const sorted = [...openings].sort((a, b) => a.offset_mm - b.offset_mm);
  for (const o of sorted) {
    const s = Math.max(cursor, -half + mmToUnit(o.offset_mm));
    const e = Math.min(half, -half + mmToUnit(o.offset_mm + o.width_mm));
    if (e <= s) continue;
    if (s > cursor) pieces.push({ x0: cursor, x1: s, y0: 0, y1: ceiling });
    const sill = mmToUnit(o.sill_mm);
    const top = mmToUnit(o.sill_mm + o.height_mm);
    if (sill > 0)
      pieces.push({ x0: s, x1: e, y0: 0, y1: Math.min(sill, ceiling) });
    if (top < ceiling) pieces.push({ x0: s, x1: e, y0: top, y1: ceiling });
    cursor = e;
  }
  if (half + cap > cursor)
    pieces.push({ x0: cursor, x1: half + cap, y0: 0, y1: ceiling });
  return pieces;
}
