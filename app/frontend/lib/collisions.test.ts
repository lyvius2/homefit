import { describe, expect, it } from "vitest";
import fixtures from "../../../docs/geometry-fixtures.json";
import type { Opening, PlacementViolation, Wall } from "~/types/domain";
import {
  boundsOfWalls,
  checkCollisions,
  type Bounds,
  type Footprint,
} from "./collisions";

interface CollisionCase {
  id: string;
  walls: Wall[];
  openings?: Opening[];
  footprints: Footprint[];
  expect: PlacementViolation[];
  expect_bounds?: Bounds;
}

const cases = (fixtures as unknown as { collisions: CollisionCase[] })
  .collisions;

describe("collisions fixtures", () => {
  for (const c of cases) {
    it(c.id, () => {
      expect(checkCollisions(c.walls, c.footprints, c.openings ?? [])).toEqual(
        c.expect,
      );
      if (c.expect_bounds)
        expect(boundsOfWalls(c.walls)).toEqual(c.expect_bounds);
    });
  }

  it("returns null bounds without walls", () => {
    expect(boundsOfWalls([])).toBeNull();
  });
});
