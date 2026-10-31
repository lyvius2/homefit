// 배치 에디터 상태 (zustand). 설계서 Section 5 S-06 상태 모델:
//   working(작업본), baseVersionNo, dirty, violations(클라이언트 판정: pointerup/키 입력 때 재계산)
import { create } from "zustand";
import { ApiError, api } from "~/lib/api";
import { checkCollisions } from "~/lib/collisions";
import { normalizeDeg, snapMm } from "~/lib/coords";
import type {
  Fixture,
  FixtureKind,
  HouseSummary,
  LayoutSummary,
  Placement,
  PlacementInput,
  PlacementViolation,
  Plan,
  VersionSummary,
} from "~/types/domain";

export interface WorkingPlacement {
  key: string;
  /** 원본 집기가 삭제된 과거 버전의 배치는 null (저장 불가) */
  fixture_id: number | null;
  x_mm: number;
  y_mm: number;
  z_mm: number;
  rotation_deg: number;
  // 렌더용 스냅샷 (저장 시에는 서버가 현재 집기에서 다시 복사한다, R-11)
  name: string;
  kind: FixtureKind;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  clearance_mm: number;
  color: string;
  image_url: string | null;
}

export type CameraMode = "top" | "iso" | "fit";

export interface LayoutEditorState {
  layoutId: number | null;
  layout: LayoutSummary | null;
  house: HouseSummary | null;
  plan: Plan | null;
  fixtures: Fixture[];
  versions: VersionSummary[];
  loading: boolean;
  loadError: string | null;

  baseVersionNo: number | null;
  working: WorkingPlacement[];
  selectedKey: string | null;
  dirty: boolean;
  violations: PlacementViolation[];
  serverViolations: PlacementViolation[];
  memo: string;
  saving: boolean;
  notice: string | null;
  /** 아카이브에서 과거 버전을 볼 때 true. "이 버전에서 이어서 편집" 으로 해제 */
  readOnly: boolean;
  dragging: boolean;
  camera: { mode: CameraMode; seq: number };
  query: string;
  kindFilter: FixtureKind | null;

  load: (
    layoutId: number,
    versionNo?: number | null,
    readOnly?: boolean,
  ) => Promise<void>;
  switchVersion: (versionNo: number) => Promise<void>;
  startEditingFromCurrent: () => void;
  addFixture: (fixtureId: number) => void;
  select: (key: string | null) => void;
  setPosition: (key: string, x_mm: number, y_mm: number) => void;
  setRotation: (key: string, rotation_deg: number) => void;
  rotateBy: (key: string, delta: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  remove: (key: string) => void;
  setDragging: (dragging: boolean) => void;
  recheck: () => void;
  setMemo: (memo: string) => void;
  save: () => Promise<boolean>;
  requestCamera: (mode: CameraMode) => void;
  setQuery: (query: string) => void;
  setKindFilter: (kind: FixtureKind | null) => void;
}

export function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function fromPlacement(p: Placement): WorkingPlacement {
  return {
    key: newKey(),
    fixture_id: p.fixture_id,
    x_mm: p.x_mm,
    y_mm: p.y_mm,
    z_mm: p.z_mm,
    rotation_deg: p.rotation_deg,
    name: p.name,
    kind: p.kind,
    width_mm: p.width_mm,
    depth_mm: p.depth_mm,
    height_mm: p.height_mm,
    clearance_mm: p.clearance_mm,
    color: p.color,
    image_url: p.image_url,
  };
}

export function fromFixture(
  f: Fixture,
  x_mm: number,
  y_mm: number,
): WorkingPlacement {
  return {
    key: newKey(),
    fixture_id: f.id,
    x_mm,
    y_mm,
    z_mm: 0,
    rotation_deg: 0,
    name: f.name,
    kind: f.kind,
    width_mm: f.width_mm,
    depth_mm: f.depth_mm,
    height_mm: f.height_mm,
    clearance_mm: f.clearance_mm,
    color: f.color,
    image_url: f.image_url,
  };
}

export function toInputs(
  working: readonly WorkingPlacement[],
): PlacementInput[] {
  return working.map((w) => ({
    fixture_id: w.fixture_id ?? 0,
    x_mm: w.x_mm,
    y_mm: w.y_mm,
    z_mm: w.z_mm,
    rotation_deg: w.rotation_deg,
  }));
}

/** 클라이언트 판정: 기하 + 삭제된 집기 */
export function computeViolations(
  plan: Plan | null,
  working: readonly WorkingPlacement[],
): PlacementViolation[] {
  const geometry = checkCollisions(
    plan?.walls ?? [],
    working.map((w) => ({
      x: w.x_mm,
      y: w.y_mm,
      width: w.width_mm,
      depth: w.depth_mm,
      rotation_deg: w.rotation_deg,
    })),
  );
  const byIndex = new Map(geometry.map((v) => [v.placement_index, v]));
  working.forEach((w, i) => {
    if (w.fixture_id !== null) return;
    const existing = byIndex.get(i);
    if (existing) existing.reasons.push("fixture_missing");
    else byIndex.set(i, { placement_index: i, reasons: ["fixture_missing"] });
  });
  return [...byIndex.values()].sort(
    (a, b) => a.placement_index - b.placement_index,
  );
}

/** 새 집기를 놓을 기본 위치: 외곽 중심(없으면 원점 근처) */
function defaultPosition(plan: Plan | null): [number, number] {
  const walls = plan?.walls ?? [];
  if (walls.length === 0) return [1000, 1000];
  const xs = walls.flatMap((w) => [w.a[0], w.b[0]]);
  const ys = walls.flatMap((w) => [w.a[1], w.b[1]]);
  return [
    snapMm((Math.min(...xs) + Math.max(...xs)) / 2),
    snapMm((Math.min(...ys) + Math.max(...ys)) / 2),
  ];
}

function withWorking(
  state: LayoutEditorState,
  working: WorkingPlacement[],
  recheck = true,
): Partial<LayoutEditorState> {
  return {
    working,
    dirty: true,
    notice: null,
    serverViolations: [],
    violations: recheck
      ? computeViolations(state.plan, working)
      : state.violations,
  };
}

export const useLayoutEditor = create<LayoutEditorState>()((set, get) => ({
  layoutId: null,
  layout: null,
  house: null,
  plan: null,
  fixtures: [],
  versions: [],
  loading: false,
  loadError: null,

  baseVersionNo: null,
  working: [],
  selectedKey: null,
  dirty: false,
  violations: [],
  serverViolations: [],
  memo: "",
  saving: false,
  notice: null,
  readOnly: false,
  dragging: false,
  camera: { mode: "iso", seq: 0 },
  query: "",
  kindFilter: null,

  async load(layoutId, versionNo = null, readOnly = false) {
    set({ layoutId, loading: true, loadError: null });
    try {
      const { layout, latest_version_no } = await api.getLayout(layoutId);
      const [planPayload, fixtures, versions] = await Promise.all([
        api.getPlan(layout.house_id),
        api.listFixtures(),
        api.listVersions(layoutId),
      ]);
      const target = versionNo ?? latest_version_no;
      const version =
        target === null ? null : await api.getVersion(layoutId, target);
      const working = version ? version.placements.map(fromPlacement) : [];
      set({
        layout,
        house: planPayload.house,
        plan: planPayload.plan,
        fixtures,
        versions,
        baseVersionNo: version?.version_no ?? null,
        working,
        selectedKey: null,
        dirty: false,
        violations: computeViolations(planPayload.plan, working),
        serverViolations: [],
        memo: "",
        readOnly: readOnly && version !== null,
        loading: false,
        camera: { mode: "fit", seq: get().camera.seq + 1 },
      });
    } catch (e) {
      set({
        loading: false,
        loadError: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async switchVersion(versionNo) {
    const { layoutId, dirty, plan } = get();
    if (!layoutId) return;
    if (
      dirty &&
      !window.confirm(
        "저장하지 않은 변경이 있습니다. 버전을 바꾸면 사라집니다. 계속할까요?",
      )
    )
      return;
    try {
      const version = await api.getVersion(layoutId, versionNo);
      const working = version.placements.map(fromPlacement);
      set({
        baseVersionNo: version.version_no,
        working,
        selectedKey: null,
        dirty: false,
        violations: computeViolations(plan, working),
        serverViolations: [],
        notice: `v${version.version_no} 을 불러왔습니다.`,
      });
    } catch (e) {
      set({ notice: e instanceof Error ? e.message : String(e) });
    }
  },

  startEditingFromCurrent() {
    const { baseVersionNo } = get();
    set({
      readOnly: false,
      dirty: true,
      notice: `v${baseVersionNo ?? "?"} 을 작업본으로 복사했습니다. 저장하면 새 버전이 됩니다.`,
    });
  },

  addFixture(fixtureId) {
    const state = get();
    if (state.readOnly) return;
    const fixture = state.fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return;
    const [x, y] = defaultPosition(state.plan);
    const placement = fromFixture(fixture, x, y);
    set((s) => ({
      ...withWorking(s, [...s.working, placement]),
      selectedKey: placement.key,
    }));
  },

  select(key) {
    set({ selectedKey: key });
  },

  // 드래그 중에는 판정하지 않는다 (60fps). pointerup 에서 recheck()
  setPosition(key, x_mm, y_mm) {
    if (get().readOnly) return;
    set((s) =>
      withWorking(
        s,
        s.working.map((w) =>
          w.key === key ? { ...w, x_mm: snapMm(x_mm), y_mm: snapMm(y_mm) } : w,
        ),
        !s.dragging,
      ),
    );
  },

  setRotation(key, rotation_deg) {
    if (get().readOnly) return;
    set((s) =>
      withWorking(
        s,
        s.working.map((w) =>
          w.key === key
            ? { ...w, rotation_deg: normalizeDeg(rotation_deg) }
            : w,
        ),
      ),
    );
  },

  rotateBy(key, delta) {
    const target = get().working.find((w) => w.key === key);
    if (target) get().setRotation(key, target.rotation_deg + delta);
  },

  nudgeSelected(dx, dy) {
    const { selectedKey, working } = get();
    const target = working.find((w) => w.key === selectedKey);
    if (!target) return;
    get().setPosition(target.key, target.x_mm + dx, target.y_mm + dy);
  },

  remove(key) {
    if (get().readOnly) return;
    set((s) => ({
      ...withWorking(
        s,
        s.working.filter((w) => w.key !== key),
      ),
      selectedKey: s.selectedKey === key ? null : s.selectedKey,
    }));
  },

  setDragging(dragging) {
    set({ dragging });
    if (!dragging) get().recheck();
  },

  recheck() {
    set((s) => ({ violations: computeViolations(s.plan, s.working) }));
  },

  setMemo(memo) {
    set({ memo: memo.slice(0, 200) });
  },

  async save() {
    const state = get();
    if (!state.layoutId || state.readOnly) return false;
    if (state.working.some((w) => w.fixture_id === null)) {
      set({
        notice:
          "삭제된 집기가 포함된 배치는 저장할 수 없습니다. 목록에서 제거하세요.",
      });
      return false;
    }
    set({ saving: true, notice: null, serverViolations: [] });
    const inputs = toInputs(state.working);
    try {
      const check = await api.validatePlacements(state.layoutId, inputs);
      if (!check.valid) {
        set({
          saving: false,
          serverViolations: check.violations,
          violations: check.violations,
          notice:
            "서버 판정: 겹침·벽 침범·외곽 이탈이 있어 저장할 수 없습니다.",
        });
        return false;
      }
      const created = await api.createVersion(
        state.layoutId,
        state.memo.trim() || null,
        inputs,
      );
      const versions = await api.listVersions(state.layoutId);
      set({
        saving: false,
        versions,
        baseVersionNo: created.version_no,
        dirty: false,
        memo: "",
        notice: `v${created.version_no} 으로 저장했습니다.`,
      });
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "collision") {
        const details = e.details as
          { violations?: PlacementViolation[] } | undefined;
        set({
          saving: false,
          serverViolations: details?.violations ?? [],
          notice: e.message,
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

  requestCamera(mode) {
    set((s) => ({ camera: { mode, seq: s.camera.seq + 1 } }));
  },

  setQuery(query) {
    set({ query });
  },

  setKindFilter(kind) {
    set({ kindFilter: kind });
  },
}));

/** 라이브러리 필터 결과 */
export function filteredFixtures(
  state: Pick<LayoutEditorState, "fixtures" | "query" | "kindFilter">,
): Fixture[] {
  const q = state.query.trim().toLowerCase();
  return state.fixtures.filter(
    (f) =>
      (!state.kindFilter || f.kind === state.kindFilter) &&
      (!q || f.name.toLowerCase().includes(q)),
  );
}

/** 작업본 index → 위반 사유 */
export function violationsByIndex(
  violations: readonly PlacementViolation[],
): Map<number, string[]> {
  return new Map(violations.map((v) => [v.placement_index, v.reasons]));
}
