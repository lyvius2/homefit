import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Fixture, Plan, Version } from "~/types/domain";

const apiMock = vi.hoisted(() => ({
  getLayout: vi.fn(),
  getPlan: vi.fn(),
  listFixtures: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  validatePlacements: vi.fn(),
  createVersion: vi.fn(),
}));
vi.mock("~/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("~/lib/api")>();
  return { ...original, api: apiMock };
});

import { ApiError } from "~/lib/api";
import { computeViolations, filteredFixtures, useLayoutEditor } from "./store";

const plan: Plan = {
  schema: 1,
  unit: "mm",
  image: null,
  scale: { px_per_mm: null, measured_mm: null, verify: null },
  walls: [
    { id: "w01", a: [0, 0], b: [9900, 0], thickness_mm: 200 },
    { id: "w02", a: [9900, 0], b: [9900, 6300], thickness_mm: 200 },
    { id: "w03", a: [9900, 6300], b: [0, 6300], thickness_mm: 200 },
    { id: "w04", a: [0, 6300], b: [0, 0], thickness_mm: 200 },
  ],
  openings: [],
};
const fridge: Fixture = {
  id: 1,
  name: "냉장고",
  kind: "appliance",
  width_mm: 913,
  depth_mm: 740,
  height_mm: 1780,
  clearance_mm: 50,
  color: "#ddd",
  image_url: null,
};
const sofa: Fixture = {
  id: 2,
  name: "소파",
  kind: "furniture",
  width_mm: 2200,
  depth_mm: 900,
  height_mm: 850,
  clearance_mm: 0,
  color: "#888",
  image_url: null,
};
const house = {
  id: 1,
  name: "집",
  ceiling_height_mm: 2300,
  dimension_basis: "centerline" as const,
  plan_status: "valid" as const,
};
const v2: Version = {
  version_no: 2,
  memo: null,
  created_at: "2026-11-01T00:00:00.000Z",
  placements: [
    {
      id: 10,
      fixture_id: 1,
      name: "냉장고",
      kind: "appliance",
      width_mm: 913,
      depth_mm: 740,
      height_mm: 1780,
      clearance_mm: 50,
      color: "#ddd",
      image_url: null,
      x_mm: 1200,
      y_mm: 1000,
      z_mm: 0,
      rotation_deg: 90,
    },
    {
      id: 11,
      fixture_id: null,
      name: "삭제된 소파",
      kind: "furniture",
      width_mm: 2000,
      depth_mm: 900,
      height_mm: 800,
      clearance_mm: 0,
      color: "#888",
      image_url: null,
      x_mm: 5000,
      y_mm: 3000,
      z_mm: 0,
      rotation_deg: 0,
    },
  ],
};

async function loadLatest() {
  apiMock.getLayout.mockResolvedValue({
    layout: { id: 7, house_id: 1, name: "기본" },
    latest_version_no: 2,
  });
  apiMock.getPlan.mockResolvedValue({ house, plan, floor_plan_url: null });
  apiMock.listFixtures.mockResolvedValue([fridge, sofa]);
  apiMock.listVersions.mockResolvedValue([
    { version_no: 2, memo: null, created_at: "", placements_count: 2 },
    { version_no: 1, memo: "첫", created_at: "", placements_count: 1 },
  ]);
  apiMock.getVersion.mockResolvedValue(v2);
  await useLayoutEditor.getState().load(7);
}

function working() {
  return useLayoutEditor.getState().working;
}

beforeEach(() => {
  vi.clearAllMocks();
  useLayoutEditor.setState(useLayoutEditor.getInitialState());
});

describe("layout editor store", () => {
  it("loads the latest version as the working copy and flags deleted fixtures", async () => {
    await loadLatest();
    const s = useLayoutEditor.getState();
    expect(s.baseVersionNo).toBe(2);
    expect(s.working.map((w) => w.name)).toEqual(["냉장고", "삭제된 소파"]);
    expect(s.dirty).toBe(false);
    expect(s.violations).toEqual([
      { placement_index: 1, reasons: ["fixture_missing"] },
    ]);
    expect(apiMock.getVersion).toHaveBeenCalledWith(7, 2);
  });

  it("adds, moves with 10 mm snap, rotates, nudges and removes placements and rechecks collisions", async () => {
    await loadLatest();
    const s = useLayoutEditor.getState();
    s.remove(working()[1]?.key ?? "");
    s.addFixture(2);
    const sofaKey = working()[1]?.key ?? "";
    expect(useLayoutEditor.getState().selectedKey).toBe(sofaKey);
    expect(working()[1]).toMatchObject({
      fixture_id: 2,
      x_mm: 4950,
      y_mm: 3150,
      rotation_deg: 0,
    });

    s.setPosition(sofaKey, 1204, 1003); // 냉장고(1200,1000) 위로 → 겹침
    expect(working()[1]).toMatchObject({ x_mm: 1200, y_mm: 1000 });
    expect(useLayoutEditor.getState().violations).toEqual([
      { placement_index: 0, reasons: ["overlap:1"] },
      { placement_index: 1, reasons: ["overlap:0"] },
    ]);

    s.setPosition(sofaKey, 5000, 3000);
    expect(useLayoutEditor.getState().violations).toEqual([]);
    s.rotateBy(sofaKey, 90);
    s.rotateBy(sofaKey, -180);
    expect(working()[1]?.rotation_deg).toBe(270);

    s.select(sofaKey);
    s.nudgeSelected(100, -10);
    expect(working()[1]).toMatchObject({ x_mm: 5100, y_mm: 2990 });
    expect(useLayoutEditor.getState().dirty).toBe(true);
  });

  it("sets elevation with 10 mm snap, never below the floor, and marks dirty", async () => {
    await loadLatest();
    const s = useLayoutEditor.getState();
    const key = working()[0]?.key ?? "";
    s.setElevation(key, 1234);
    expect(working()[0]?.z_mm).toBe(1230);
    s.select(key);
    s.elevateSelected(-5000);
    expect(working()[0]?.z_mm).toBe(0);
    s.elevateSelected(100);
    expect(working()[0]?.z_mm).toBe(100);
    expect(useLayoutEditor.getState().dirty).toBe(true);
  });

  it("settles a dropped fixture on top of the fixture under it, or on the floor", async () => {
    await loadLatest();
    const s = useLayoutEditor.getState();
    const [first, second] = working();
    if (!first || !second) throw new Error("fixture");
    // second 를 first 위로 옮겨 놓으면 first 윗면 높이로
    s.setPosition(second.key, first.x_mm, first.y_mm);
    s.settle(second.key);
    expect(working()[1]?.z_mm).toBe(first.height_mm);
    // 아무것도 없는 곳으로 옮겨 놓으면 바닥으로
    s.setPosition(second.key, first.x_mm + 50_000, first.y_mm);
    s.settle(second.key);
    expect(working()[1]?.z_mm).toBe(0);
  });

  it("skips rechecks while dragging and rechecks on drop", async () => {
    await loadLatest();
    const s = useLayoutEditor.getState();
    s.remove(working()[1]?.key ?? "");
    s.addFixture(2);
    const sofaKey = working()[1]?.key ?? "";
    s.setDragging(true);
    s.setPosition(sofaKey, 1200, 1000);
    expect(useLayoutEditor.getState().violations).toEqual([]);
    s.setDragging(false);
    expect(useLayoutEditor.getState().violations).toHaveLength(2);
  });

  it("saves after a server validation and refuses deleted fixtures", async () => {
    await loadLatest();
    expect(await useLayoutEditor.getState().save()).toBe(false);
    expect(useLayoutEditor.getState().notice).toMatch(/삭제된 집기/);

    useLayoutEditor.getState().remove(working()[1]?.key ?? "");
    useLayoutEditor.getState().setMemo("저장 테스트");
    apiMock.validatePlacements.mockResolvedValueOnce({
      valid: true,
      violations: [],
    });
    apiMock.createVersion.mockResolvedValueOnce({
      version_no: 3,
      created_at: "2026-11-01T01:00:00.000Z",
    });
    apiMock.listVersions.mockResolvedValueOnce([
      {
        version_no: 3,
        memo: "저장 테스트",
        created_at: "",
        placements_count: 1,
      },
    ]);

    expect(await useLayoutEditor.getState().save()).toBe(true);
    expect(apiMock.createVersion).toHaveBeenCalledWith(7, "저장 테스트", [
      { fixture_id: 1, x_mm: 1200, y_mm: 1000, z_mm: 0, rotation_deg: 90 },
    ]);
    const s = useLayoutEditor.getState();
    expect(s.baseVersionNo).toBe(3);
    expect(s.dirty).toBe(false);
    expect(s.memo).toBe("");
    expect(s.versions[0]?.version_no).toBe(3);
  });

  it("shows server violations when validation or creation fails", async () => {
    await loadLatest();
    useLayoutEditor.getState().remove(working()[1]?.key ?? "");
    apiMock.validatePlacements.mockResolvedValueOnce({
      valid: false,
      violations: [{ placement_index: 0, reasons: ["wall:w01"] }],
    });
    expect(await useLayoutEditor.getState().save()).toBe(false);
    expect(useLayoutEditor.getState().serverViolations).toEqual([
      { placement_index: 0, reasons: ["wall:w01"] },
    ]);

    apiMock.validatePlacements.mockResolvedValueOnce({
      valid: true,
      violations: [],
    });
    apiMock.createVersion.mockRejectedValueOnce(
      new ApiError(422, {
        code: "collision",
        message: "겹침",
        details: {
          violations: [{ placement_index: 0, reasons: ["overlap:1"] }],
        },
      }),
    );
    expect(await useLayoutEditor.getState().save()).toBe(false);
    expect(useLayoutEditor.getState().serverViolations).toEqual([
      { placement_index: 0, reasons: ["overlap:1"] },
    ]);
  });

  it("switches versions and supports read-only archive viewing", async () => {
    await loadLatest();
    apiMock.getVersion.mockResolvedValueOnce({
      ...v2,
      version_no: 1,
      placements: [v2.placements[0] as Version["placements"][number]],
    });
    await useLayoutEditor.getState().switchVersion(1);
    expect(useLayoutEditor.getState().baseVersionNo).toBe(1);
    expect(working()).toHaveLength(1);

    useLayoutEditor.setState(useLayoutEditor.getInitialState());
    apiMock.getVersion.mockResolvedValueOnce(v2);
    await useLayoutEditor.getState().load(7, 2, true);
    const s = useLayoutEditor.getState();
    expect(s.readOnly).toBe(true);
    s.addFixture(2);
    expect(working()).toHaveLength(2);
    s.startEditingFromCurrent();
    expect(useLayoutEditor.getState().readOnly).toBe(false);
    useLayoutEditor.getState().addFixture(2);
    expect(working()).toHaveLength(3);
  });

  it("filters the library and computes violations for empty plans", () => {
    expect(
      filteredFixtures({
        fixtures: [fridge, sofa],
        query: "소",
        kindFilter: null,
      }).map((f) => f.id),
    ).toEqual([2]);
    expect(
      filteredFixtures({
        fixtures: [fridge, sofa],
        query: "",
        kindFilter: "appliance",
      }).map((f) => f.id),
    ).toEqual([1]);
    expect(computeViolations(null, [])).toEqual([]);
  });
});
