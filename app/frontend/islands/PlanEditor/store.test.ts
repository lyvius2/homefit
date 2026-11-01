import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "~/types/domain";

const apiMock = vi.hoisted(() => ({
  getPlan: vi.fn(),
  savePlan: vi.fn(),
  validatePlan: vi.fn(),
}));
vi.mock("~/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/lib/api")>();
  return { ...original, api: apiMock };
});

import { ApiError } from "~/lib/api";
import { renderPxPerMm, usePlanEditor } from "./store";

const emptyPlan: Plan = {
  schema: 1,
  unit: "mm",
  image: null,
  scale: { px_per_mm: null, measured_mm: null, verify: null },
  walls: [],
  openings: [],
};

const house = {
  id: 1,
  name: "집",
  ceiling_height_mm: 2300,
  dimension_basis: "centerline" as const,
  plan_status: "draft" as const,
};

function currentPlan(): Plan {
  const plan = usePlanEditor.getState().plan;
  if (!plan) throw new Error("plan not loaded");
  return plan;
}

function currentStatus(): string {
  const h = usePlanEditor.getState().house;
  if (!h) throw new Error("house not loaded");
  return h.plan_status;
}

async function loadWith(plan: Plan, floor_plan_url: string | null = null) {
  apiMock.getPlan.mockResolvedValue({ house, plan, floor_plan_url });
  await usePlanEditor.getState().load(1);
}

beforeEach(() => {
  vi.clearAllMocks();
  usePlanEditor.setState(usePlanEditor.getInitialState());
});

describe("plan editor store", () => {
  it("draws walls in integer mm with grid, right-angle and endpoint snapping", async () => {
    await loadWith(emptyPlan);
    const s = usePlanEditor.getState();
    expect(s.tool).toBe("wall");
    expect(renderPxPerMm(s.plan)).toBe(0.1);

    s.canvasClick({ x: 0, y: 0 });
    s.canvasClick({ x: 990.4, y: 3 }); // 9,904 mm → 격자 9,900, 직각 스냅으로 y=0
    s.canvasClick({ x: 991, y: 630 });

    const plan = currentPlan();
    expect(plan.walls).toEqual([
      { id: "w01", a: [0, 0], b: [9900, 0], thickness_mm: 200 },
      { id: "w02", a: [9900, 0], b: [9900, 6300], thickness_mm: 200 },
    ]);
    expect(usePlanEditor.getState().dirty).toBe(true);
    expect(usePlanEditor.getState().pendingMm).toEqual([9900, 6300]);
  });

  it("requires a scale before drawing on an image", async () => {
    await loadWith(
      { ...emptyPlan, image: { width_px: 1000, height_px: 800 } },
      "/img",
    );
    let s = usePlanEditor.getState();
    expect(s.tool).toBe("scale");
    expect(renderPxPerMm(s.plan)).toBeNull();

    s.setMeasureMm(3600);
    s.canvasClick({ x: 100, y: 100 });
    s.canvasClick({ x: 460, y: 100 });
    s = usePlanEditor.getState();
    expect(currentPlan().scale).toEqual({
      px_per_mm: 0.1,
      measured_mm: 3600,
      verify: null,
    });
    expect(s.tool).toBe("wall");

    s.setTool("verify");
    s.setMeasureMm(2400);
    s.canvasClick({ x: 0, y: 0 });
    s.canvasClick({ x: 246, y: 0 });
    expect(currentPlan().scale.verify).toEqual({
      measured_mm: 2400,
      got_mm: 2460,
      error_pct: 2.5,
    });
  });

  it("selects, re-thickens and deletes walls together with their openings", async () => {
    await loadWith({
      ...emptyPlan,
      walls: [{ id: "w01", a: [0, 0], b: [9900, 0], thickness_mm: 200 }],
      openings: [
        {
          id: "o01",
          wall_id: "w01",
          offset_mm: 100,
          width_mm: 900,
          height_mm: 2100,
          sill_mm: 0,
          type: "door",
        },
      ],
    });
    const s = usePlanEditor.getState();
    s.setTool("select");
    s.selectWall("w01");
    s.setSelectedThickness(120);
    expect(currentPlan().walls[0]?.thickness_mm).toBe(120);

    s.deleteSelected();
    const plan = currentPlan();
    expect(plan.walls).toEqual([]);
    expect(plan.openings).toEqual([]);
  });

  it("places, edits, flips and deletes hinged doors with the door tool", async () => {
    await loadWith({
      ...emptyPlan,
      walls: [
        { id: "w01", a: [0, 0], b: [9900, 0], thickness_mm: 200 },
        { id: "w02", a: [9900, 0], b: [9900, 6300], thickness_mm: 200 },
      ],
    });
    let s = usePlanEditor.getState();
    s.setTool("door");
    s.setDoorWidth(900);
    s.canvasClick({ x: 300, y: 10 }); // (3000, 100) mm, w01 의 오른쪽(아래)
    s = usePlanEditor.getState();
    expect(currentPlan().openings).toEqual([
      {
        id: "o01",
        wall_id: "w01",
        offset_mm: 2550,
        width_mm: 900,
        height_mm: 2100,
        sill_mm: 0,
        type: "door",
        swing: { hinge: "a", side: "right" },
      },
    ]);
    expect(s.selectedOpeningId).toBe("o01");
    expect(s.dirty).toBe(true);

    s.canvasClick({ x: 500, y: 300 }); // 어느 벽에서도 300 mm 밖
    expect(currentPlan().openings).toHaveLength(1);
    expect(usePlanEditor.getState().notice).toMatch(/벽 가까이/);

    s.flipHinge();
    s.flipSide();
    expect(currentPlan().openings[0]?.swing).toEqual({
      hinge: "b",
      side: "left",
    });

    s.updateSelectedOpening({ offset_mm: 9500, width_mm: 1000 });
    expect(currentPlan().openings[0]).toMatchObject({
      offset_mm: 8900,
      width_mm: 1000,
    });

    s.setTool("select");
    s.selectWall("w01");
    expect(usePlanEditor.getState().selectedOpeningId).toBeNull();
    s.selectOpening("o01");
    expect(usePlanEditor.getState().selectedWallId).toBeNull();
    s.deleteSelected();
    expect(currentPlan().openings).toEqual([]);
    expect(currentPlan().walls).toHaveLength(2);
  });

  it("gives legacy doors a default swing on request", async () => {
    await loadWith({
      ...emptyPlan,
      walls: [{ id: "w01", a: [0, 0], b: [9900, 0], thickness_mm: 200 }],
      openings: [
        {
          id: "o01",
          wall_id: "w01",
          offset_mm: 100,
          width_mm: 900,
          height_mm: 2100,
          sill_mm: 0,
          type: "door",
        },
      ],
    });
    const s = usePlanEditor.getState();
    s.selectOpening("o01");
    s.flipHinge(); // swing 이 없으면 무시
    expect(currentPlan().openings[0]?.swing).toBeUndefined();
    s.setDefaultSwing();
    expect(currentPlan().openings[0]?.swing).toEqual({
      hinge: "a",
      side: "left",
    });
  });

  it("saves through the api and surfaces plan_invalid violations", async () => {
    await loadWith(emptyPlan);
    apiMock.savePlan.mockRejectedValueOnce(
      new ApiError(422, {
        code: "plan_invalid",
        message: "x",
        details: [{ code: "walls_min", message: "벽 부족", path: "/walls" }],
      }),
    );
    expect(await usePlanEditor.getState().save()).toBe(false);
    expect(usePlanEditor.getState().violations).toEqual([
      { code: "walls_min", message: "벽 부족", path: "/walls" },
    ]);

    const saved = {
      ...emptyPlan,
      walls: [{ id: "w01", a: [0, 0], b: [1, 0], thickness_mm: 1 }],
    };
    apiMock.savePlan.mockResolvedValueOnce({
      plan: saved,
      plan_status: "valid",
    });
    expect(await usePlanEditor.getState().save()).toBe(true);
    const s = usePlanEditor.getState();
    expect(s.dirty).toBe(false);
    expect(currentStatus()).toBe("valid");
    expect(s.plan).toEqual(saved);
    expect(s.violations).toEqual([]);
  });
});
