// 도면 에디터 상태 (zustand). 벽 좌표는 항상 정수 mm. 캔버스 클릭은 월드 px 로 들어와 여기서 mm 로 바뀐다.
import { create } from "zustand";
import { ApiError, api } from "~/lib/api";
import type {
  HouseSummary,
  Plan,
  PlanViolation,
  Point,
  Wall,
} from "~/types/domain";
import {
  NO_IMAGE_PX_PER_MM,
  nextWallId,
  pointPxToMm,
  scaleFromPoints,
  snapRightAngle,
  snapToEndpoints,
  snapToGrid,
  verifyFromPoints,
  type Pt,
} from "./planMath";

export type Tool = "select" | "wall" | "scale" | "verify";

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
  selectedWallId: string | null;
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
  selectWall: (id: string | null) => void;
  deleteSelected: () => void;
  setSelectedThickness: (mm: number) => void;
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
  selectedWallId: null,
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

  selectWall(id) {
    set({ selectedWallId: id });
  },

  deleteSelected() {
    const id = get().selectedWallId;
    if (!id || get().readOnly) return;
    set((s) => ({
      ...updatePlan(s, (plan) => ({
        ...plan,
        walls: plan.walls.filter((w) => w.id !== id),
        openings: plan.openings.filter((o) => o.wall_id !== id),
      })),
      selectedWallId: null,
    }));
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
      case "select":
        set({ selectedWallId: null });
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
