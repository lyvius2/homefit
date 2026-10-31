import { describe, expect, it } from "vitest";
import fixtures from "../../../docs/geometry-fixtures.json";
import {
  EPSILON,
  obbCorners,
  obbFromFootprint,
  obbFromSegment,
  satIntersects,
  type Obb,
} from "./geometry";

// docs/geometry-fixtures.json 의 모든 케이스를 TS 구현으로 검증한다.
// Ruby 구현(test/lib/geometry/geometry_test.rb)도 같은 파일을 읽는다.

interface BoxShape {
  kind: "box";
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation_deg: number;
}
interface WallShape {
  kind: "wall";
  a: [number, number];
  b: [number, number];
  thickness_mm: number;
}
type Shape = BoxShape | WallShape;

interface Fixtures {
  epsilon: number;
  corners: { id: string; shape: Shape; expect: [number, number][] }[];
  sat: { id: string; a: Shape; b: Shape; expect: boolean }[];
}

const data = fixtures as unknown as Fixtures;

function build(shape: Shape): Obb {
  switch (shape.kind) {
    case "box":
      return obbFromFootprint(shape);
    case "wall":
      return obbFromSegment({
        ax: shape.a[0],
        ay: shape.a[1],
        bx: shape.b[0],
        by: shape.b[1],
        thickness: shape.thickness_mm,
      });
  }
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6 + 0; // +0 은 -0 을 0 으로

describe("geometry fixtures", () => {
  it("epsilon matches the fixture file", () => {
    expect(EPSILON).toBe(data.epsilon);
  });

  describe("corners", () => {
    for (const c of data.corners) {
      it(c.id, () => {
        const actual = obbCorners(build(c.shape)).map(([x, y]) => [
          round6(x),
          round6(y),
        ]);
        expect(actual).toEqual(c.expect);
      });
    }
  });

  describe("sat", () => {
    for (const c of data.sat) {
      it(c.id, () => {
        const a = build(c.a);
        const b = build(c.b);
        expect(satIntersects(a, b)).toBe(c.expect);
        expect(satIntersects(b, a)).toBe(c.expect);
      });
    }
  });
});
