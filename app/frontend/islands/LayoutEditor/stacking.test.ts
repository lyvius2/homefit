import { describe, expect, it } from "vitest";
import { restingZ } from "./stacking";

const desk = {
  key: "desk",
  x_mm: 2000,
  y_mm: 2000,
  z_mm: 0,
  rotation_deg: 0,
  width_mm: 1200,
  depth_mm: 600,
  height_mm: 730,
};
const monitor = {
  key: "monitor",
  x_mm: 2000,
  y_mm: 1900,
  z_mm: 0,
  rotation_deg: 0,
  width_mm: 600,
  depth_mm: 200,
  height_mm: 400,
};

describe("restingZ", () => {
  it("lands a fixture on top of the fixture under it", () => {
    expect(restingZ([desk, monitor], "monitor")).toBe(730);
  });

  it("drops to the floor when nothing is under it", () => {
    expect(
      restingZ([desk, { ...monitor, x_mm: 5000, z_mm: 730 }], "monitor"),
    ).toBe(0);
    expect(restingZ([monitor], "monitor")).toBe(0);
  });

  it("does not lift a fixture that is dragged under one already resting on it", () => {
    expect(restingZ([desk, { ...monitor, z_mm: 730 }], "desk")).toBe(0);
  });

  it("uses the tallest support and ignores touching edges", () => {
    const cabinet = { ...desk, key: "cabinet", x_mm: 2300, height_mm: 900 };
    expect(restingZ([desk, cabinet, monitor], "monitor")).toBe(900);
    // 책상 오른쪽 끝(x=2600)에 맞닿기만 하는 집기는 받침이 아니다
    expect(restingZ([desk, { ...monitor, x_mm: 2900 }], "monitor")).toBe(0);
  });
});
