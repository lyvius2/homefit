import { describe, expect, it } from "vitest";
import type { Opening, Wall } from "~/types/domain";
import { wallPieces } from "./wallPieces";

const wall: Wall = { id: "w01", a: [0, 0], b: [9900, 0], thickness_mm: 200 };
const door: Opening = {
  id: "o01",
  wall_id: "w01",
  offset_mm: 1200,
  width_mm: 900,
  height_mm: 2100,
  sill_mm: 0,
  type: "door",
};
const window: Opening = {
  id: "o02",
  wall_id: "w01",
  offset_mm: 5000,
  width_mm: 2000,
  height_mm: 1200,
  sill_mm: 900,
  type: "window",
};

describe("wallPieces", () => {
  it("is one full box with t/2 caps when there are no openings", () => {
    expect(wallPieces(wall, [], 2.3)).toEqual([
      { x0: -5.05, x1: 5.05, y0: 0, y1: 2.3 },
    ]);
  });

  it("leaves a gap for a door with a lintel above and a sill piece for a window", () => {
    const pieces = wallPieces(wall, [window, door], 2.3).map((p) => ({
      x0: +p.x0.toFixed(3),
      x1: +p.x1.toFixed(3),
      y0: +p.y0.toFixed(3),
      y1: +p.y1.toFixed(3),
    }));
    expect(pieces).toEqual([
      { x0: -5.05, x1: -3.75, y0: 0, y1: 2.3 }, // a 쪽 끝 ~ 문 시작
      { x0: -3.75, x1: -2.85, y0: 2.1, y1: 2.3 }, // 문 상인방
      { x0: -2.85, x1: 0.05, y0: 0, y1: 2.3 }, // 문 끝 ~ 창 시작
      { x0: 0.05, x1: 2.05, y0: 0, y1: 0.9 }, // 창 아래
      { x0: 0.05, x1: 2.05, y0: 2.1, y1: 2.3 }, // 창 위
      { x0: 2.05, x1: 5.05, y0: 0, y1: 2.3 },
    ]);
  });

  it("clips openings that run past the wall and skips empty ones", () => {
    const pieces = wallPieces(wall, [{ ...door, offset_mm: 9500 }], 2.3);
    expect(
      pieces.map((p) => [+p.x0.toFixed(3), +p.x1.toFixed(3), p.y0]),
    ).toEqual([
      [-5.05, 4.55, 0],
      [4.55, 4.95, 2.1],
      [4.95, 5.05, 0],
    ]);
    expect(wallPieces(wall, [{ ...door, offset_mm: 20000 }], 2.3)).toHaveLength(
      1,
    );
  });
});
