// 도면 에디터 상태 (zustand). 벽 좌표는 항상 정수 mm. 캔버스 클릭은 월드 px 로 들어와 여기서 mm 로 바뀐다.
import { create } from "zustand";
import { ApiError, api } from "~/lib/api";
import type {
  HouseSummary,
  Opening,
  Plan,
  PlanViolation,
  Point,
  Wall,
} from "~/types/domain";
import {
  DOOR_WIDTH_MM,
  NO_IMAGE_PX_PER_MM,
  clampOpeningOffset,
  nextWallId,
  placeDoor,
  pointPxToMm,
  scaleFromPoints,
  snapRightAngle,
  snapToEndpoints,
  snapToGrid,
  verifyFromPoints,
  type Pt,
} from "./planMath";

export type Tool = "select" | "wall" | "door" | "scale" | "verify";

export interface PlanEditorState {
  houseId: number | null;
  house: HouseSummary | null;
  plan: Plan | null;
  floorPlanUrl: string | null;
  loading: boolean;
  loadError: string | null;

  tool: Tool;
  thickness_mm: number;
  rightAngle: boolean;
  measureMm: number | null;
  /** 문 도구로 놓을 새 문의 폭 */
  doorWidthMm: number;
  selectedWallId: string | null;
  /** 벽과 동시에 선택되지 않는다 */
  selectedOpeningId: string | null;
  /** 벽 그리기의 시작점(mm) */
  pendingMm: Point | null;
  /** 축척·검증 측정의 첫 점(월드 px) */
  pendingPx: Pt | null;

  dirty: boolean;
  saving: boolean;
  violations: PlanViolation[];
  notice: string | null;
  /** 모바일(< 1024 px) 보기 전용 */
  readOnly: boolean;

  load: (houseId: number, readOnly?: boolean) => Promise<void>;
  setTool: (tool: Tool) => void;
  setThickness: (mm: number) => void;
  toggleRightAngle: () => void;
  setMeasureMm: (mm: number | null) => void;
  setDoorWidth: (mm: number) => void;
  selectWall: (id: string | null) => void;
  selectOpening: (id: string | null) => void;
  /** 선택 벽 또는 선택 문(문이 우선) 삭제 */
  deleteSelected: () => void;
  setSelectedThickness: (mm: number) => void;
  /** 선택 문의 오프셋·폭·높이. 오프셋은 벽 안으로 묶는다 */
  updateSelectedOpening: (
    patch: Partial<Pick<Opening, "offset_mm" | "width_mm" | "height_mm">>,
  ) => void;
  /** 경첩을 반대쪽 끝으로 */
  flipHinge: () => void;
  /** 열리는 면을 반대쪽으로 */
  flipSide: () => void;
  /** swing 이 없는 기존 문에 기본 열림 방향을 준다 */
  setDefaultSwing: () => void;
  canvasClick: (worldPx: Pt) => void;
  cancelPending: () => void;
  clearScale: () => void;
  save: () => Promise<boolean>;
  validate: () => Promise<void>;
}

/** 현재 렌더 축척(px/mm). 이미지가 있는데 축척이 없으면 null (벽 그리기 불가, R-04). */
export function renderPxPerMm(plan: Plan | null): number | null {
  if (!plan) return null;
  if (plan.image) return plan.scale.px_per_mm;
  return plan.scale.px_per_mm ?? NO_IMAGE_PX_PER_MM;
}

function updatePlan(
  state: PlanEditorState,
  patch: (plan: Plan) => Plan,
): Partial<PlanEditorState> {
  if (!state.plan) return {};
  return { plan: patch(state.plan), dirty: true, notice: null };
}

type Setter = (
  partial:
    | Partial<PlanEditorState>
    | ((s: PlanEditorState) => Partial<PlanEditorState>),
) => void;

/** 선택된 문의 swing 을 고친다. swing 이 없는 문은 allowMissing 일 때만(기본값 부여) */
function patchSelectedSwing(
  set: Setter,
  get: () => PlanEditorState,
  patch: (swing: NonNullable<Opening["swing"]>) => Opening["swing"],
  allowMissing = false,
) {
  const { selectedOpeningId, readOnly } = get();
  if (!selectedOpeningId || readOnly) return;
  set((s) =>
    updatePlan(s, (plan) => ({
      ...plan,
      openings: plan.openings.map((o) => {
        if (o.id !== selectedOpeningId || o.type !== "door") return o;
        if (!o.swing && !allowMissing) return o;
        return { ...o, swing: patch(o.swing ?? { hinge: "a", side: "left" }) };
      }),
    })),
  );
}

export const usePlanEditor = create<PlanEditorState>()((set, get) => ({
  houseId: null,
  house: null,
  plan: null,
  floorPlanUrl: null,
  loading: false,
  loadError: null,

  tool: "select",
  thickness_mm: 200,
  rightAngle: true,
  measureMm: null,
  doorWidthMm: DOOR_WIDTH_MM,
  selectedWallId: null,
  selectedOpeningId: null,
  pendingMm: null,
  pendingPx: null,

  dirty: false,
  saving: false,
  violations: [],
  notice: null,
  readOnly: false,

  async load(houseId, readOnly = false) {
    set({ houseId, loading: true, loadError: null, readOnly });
    try {
      const payload = await api.getPlan(houseId);
      const needsScale =
        payload.plan.image !== null && payload.plan.scale.px_per_mm === null;
      set({
        house: payload.house,
        plan: payload.plan,
        floorPlanUrl: payload.floor_plan_url,
        loading: false,
        tool: readOnly ? "select" : needsScale ? "scale" : "wall",
        dirty: false,
        violations: [],
      });
    } catch (e) {
      set({
        loading: false,
        loadError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  setTool(tool) {
    set({
      tool,
      pendingMm: null,
      pendingPx: null,
      selectedWallId: tool === "select" ? get().selectedWallId : null,
      selectedOpeningId:
        tool === "select" || tool === "door" ? get().selectedOpeningId : null,
    });
  },

  setThickness(mm) {
    set({ thickness_mm: Math.max(1, Math.round(mm)) });
  },

  toggleRightAngle() {
    set((s) => ({ rightAngle: !s.rightAngle }));
  },

  setMeasureMm(mm) {
    set({ measureMm: mm && mm > 0 ? Math.round(mm) : null, pendingPx: null });
  },

  setDoorWidth(mm) {
    set({ doorWidthMm: Math.max(1, Math.round(mm)) });
  },

  selectWall(id) {
    set({ selectedWallId: id, selectedOpeningId: null });
  },

  selectOpening(id) {
    set({ selectedOpeningId: id, selectedWallId: null });
  },

  deleteSelected() {
    const { selectedWallId, selectedOpeningId, readOnly } = get();
    if (readOnly) return;
    if (selectedOpeningId) {
      set((s) => ({
        ...updatePlan(s, (plan) => ({
          ...plan,
          openings: plan.openings.filter((o) => o.id !== selectedOpeningId),
        })),
        selectedOpeningId: null,
      }));
      return;
    }
    if (!selectedWallId) return;
    set((s) => ({
      ...updatePlan(s, (plan) => ({
        ...plan,
        walls: plan.walls.filter((w) => w.id !== selectedWallId),
        openings: plan.openings.filter((o) => o.wall_id !== selectedWallId),
      })),
      selectedWallId: null,
    }));
  },

  updateSelectedOpening(patch) {
    const { selectedOpeningId, readOnly } = get();
    if (!selectedOpeningId || readOnly) return;
    set((s) =>
      updatePlan(s, (plan) => ({
        ...plan,
        openings: plan.openings.map((o) => {
          if (o.id !== selectedOpeningId) return o;
          const wall = plan.walls.find((w) => w.id === o.wall_id);
          const width_mm = Math.max(
            1,
            Math.round(patch.width_mm ?? o.width_mm),
          );
          const height_mm = Math.max(
            1,
            Math.round(patch.height_mm ?? o.height_mm),
          );
          const rawOffset = Math.round(patch.offset_mm ?? o.offset_mm);
          const offset_mm = wall
            ? clampOpeningOffset(wall, rawOffset, width_mm)
            : Math.max(0, rawOffset);
          return { ...o, offset_mm, width_mm, height_mm };
        }),
      })),
    );
  },

  flipHinge() {
    patchSelectedSwing(set, get, (swing) => ({
      ...swing,
      hinge: swing.hinge === "a" ? "b" : "a",
    }));
  },

  flipSide() {
    patchSelectedSwing(set, get, (swing) => ({
      ...swing,
      side: swing.side === "left" ? "right" : "left",
    }));
  },

  setDefaultSwing() {
    patchSelectedSwing(set, get, () => ({ hinge: "a", side: "left" }), true);
  },

  setSelectedThickness(mm) {
    const id = get().selectedWallId;
    if (!id || get().readOnly) return;
    const thickness = Math.max(1, Math.round(mm));
    set((s) =>
      updatePlan(s, (plan) => ({
        ...plan,
        walls: plan.walls.map((w) =>
          w.id === id ? { ...w, thickness_mm: thickness } : w,
        ),
      })),
    );
  },

  canvasClick(worldPx) {
    const state = get();
    const plan = state.plan;
    if (!plan || state.readOnly) return;

    switch (state.tool) {
      case "scale": {
        if (!state.measureMm) {
          set({ notice: "축척을 잡으려면 먼저 실제 길이(mm)를 입력하세요." });
          return;
        }
        if (!state.pendingPx) {
          set({ pendingPx: worldPx });
          return;
        }
        const px_per_mm = scaleFromPoints(
          state.pendingPx,
          worldPx,
          state.measureMm,
        );
        if (px_per_mm <= 0) return;
        set((s) => ({
          ...updatePlan(s, (p) => ({
            ...p,
            scale: { px_per_mm, measured_mm: state.measureMm, verify: null },
          })),
          pendingPx: null,
          notice: `축척 설정: ${px_per_mm} px/mm`,
          tool: "wall",
        }));
        return;
      }
      case "verify": {
        const pxPerMm = renderPxPerMm(plan);
        if (!pxPerMm || !state.measureMm) {
          set({
            notice:
              "검증하려면 축척이 있어야 하고 실제 길이(mm)를 입력해야 합니다.",
          });
          return;
        }
        if (!state.pendingPx) {
          set({ pendingPx: worldPx });
          return;
        }
        const verify = verifyFromPoints(
          state.pendingPx,
          worldPx,
          state.measureMm,
          pxPerMm,
        );
        set((s) => ({
          ...updatePlan(s, (p) => ({ ...p, scale: { ...p.scale, verify } })),
          pendingPx: null,
          notice: `검증: ${verify.got_mm.toLocaleString()} mm 로 측정됨 (오차 ${verify.error_pct}%)`,
        }));
        return;
      }
      case "wall": {
        const pxPerMm = renderPxPerMm(plan);
        if (!pxPerMm) {
          set({
            notice:
              "도면 이미지가 있으면 먼저 축척을 설정해야 벽을 그릴 수 있습니다.",
            tool: "scale",
          });
          return;
        }
        let point = snapToEndpoints(
          snapToGrid(pointPxToMm(worldPx, pxPerMm)),
          plan.walls,
        );
        if (state.pendingMm && state.rightAngle)
          point = snapRightAngle(state.pendingMm, point);
        if (!state.pendingMm) {
          set({ pendingMm: point });
          return;
        }
        if (point[0] === state.pendingMm[0] && point[1] === state.pendingMm[1])
          return;
        const wall: Wall = {
          id: nextWallId(plan.walls),
          a: state.pendingMm,
          b: point,
          thickness_mm: state.thickness_mm,
        };
        set((s) => ({
          ...updatePlan(s, (p) => ({ ...p, walls: [...p.walls, wall] })),
          pendingMm: point,
          selectedWallId: wall.id,
        }));
        return;
      }
      case "door": {
        const pxPerMm = renderPxPerMm(plan);
        if (!pxPerMm) {
          set({
            notice:
              "도면 이미지가 있으면 먼저 축척을 설정해야 문을 놓을 수 있습니다.",
            tool: "scale",
          });
          return;
        }
        const door = placeDoor(
          pointPxToMm(worldPx, pxPerMm),
          plan.walls,
          plan.openings,
          state.doorWidthMm,
        );
        if (!door) {
          set({
            notice:
              "벽 가까이(300 mm 이내)를 클릭하세요. 문 폭보다 짧은 벽에는 놓을 수 없습니다.",
          });
          return;
        }
        set((s) => ({
          ...updatePlan(s, (p) => ({ ...p, openings: [...p.openings, door] })),
          selectedOpeningId: door.id,
          selectedWallId: null,
        }));
        return;
      }
      case "select":
        set({ selectedWallId: null, selectedOpeningId: null });
    }
  },

  cancelPending() {
    set({ pendingMm: null, pendingPx: null });
  },

  clearScale() {
    if (get().readOnly) return;
    set((s) => ({
      ...updatePlan(s, (p) => ({
        ...p,
        scale: { px_per_mm: null, measured_mm: null, verify: null },
      })),
      tool: "scale",
      pendingMm: null,
      pendingPx: null,
    }));
  },

  async save() {
    const { houseId, plan, readOnly } = get();
    if (!houseId || !plan || readOnly) return false;
    set({ saving: true, violations: [], notice: null });
    try {
      const result = await api.savePlan(houseId, plan);
      set((s) => ({
        saving: false,
        plan: result.plan,
        dirty: false,
        house: s.house
          ? { ...s.house, plan_status: result.plan_status }
          : s.house,
        notice: "도면을 저장했습니다.",
      }));
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "plan_invalid") {
        set({
          saving: false,
          violations: (e.details as PlanViolation[]) ?? [],
          notice: null,
        });
      } else {
        set({
          saving: false,
          notice: e instanceof Error ? `저장 실패: ${e.message}` : "저장 실패",
        });
      }
      return false;
    }
  },

  async validate() {
    const { houseId, plan } = get();
    if (!houseId || !plan) return;
    try {
      const result = await api.validatePlan(houseId, plan);
      set({
        violations: result.violations,
        notice: result.valid ? "저장 가능한 도면입니다." : null,
      });
    } catch (e) {
      set({
        notice: e instanceof Error ? `검증 실패: ${e.message}` : "검증 실패",
      });
    }
  },
}));
