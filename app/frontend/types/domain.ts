// 서버 JSON 과 같은 필드명(snake_case)을 그대로 쓴다. 변환 레이어를 두지 않는다 (AGENTS.md).
// 길이는 정수 mm, 회전은 정수 도 (R-01).

export type Point = [number, number];

export interface Wall {
  id: string;
  a: Point;
  b: Point;
  thickness_mm: number;
}

export type OpeningType = "door" | "window";

/** 여닫이문의 경첩 위치·열림 방향 (설계서 Section 2.3). hinge: 개구부 시작(벽 a 쪽)/끝(b 쪽), side: a→b 기준 왼쪽/오른쪽 */
export interface DoorSwing {
  hinge: "a" | "b";
  side: "left" | "right";
}

export interface Opening {
  id: string;
  wall_id: string;
  offset_mm: number;
  width_mm: number;
  height_mm: number;
  sill_mm: number;
  type: OpeningType;
  /** door 전용. 없으면 열림 영역을 만들지 않는다 */
  swing?: DoorSwing;
}

export interface PlanImage {
  width_px: number;
  height_px: number;
}

export interface PlanVerify {
  measured_mm: number;
  got_mm: number;
  error_pct: number;
}

export interface PlanScale {
  px_per_mm: number | null;
  measured_mm: number | null;
  verify: PlanVerify | null;
}

export interface Plan {
  schema: 1;
  unit: "mm";
  image: PlanImage | null;
  scale: PlanScale;
  walls: Wall[];
  openings: Opening[];
}

export type PlanStatus = "draft" | "valid";
export type DimensionBasis = "centerline" | "clear";

export interface HouseSummary {
  id: number;
  name: string;
  ceiling_height_mm: number;
  dimension_basis: DimensionBasis;
  plan_status: PlanStatus;
}

export type FixtureKind = "furniture" | "appliance" | "etc";

export interface Fixture {
  id: number;
  name: string;
  kind: FixtureKind;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  clearance_mm: number;
  color: string;
  image_url: string | null;
}

/** 버전 저장/검증 요청의 배치 항목. 스냅샷은 서버가 복사한다 (R-11). */
export interface PlacementInput {
  fixture_id: number;
  x_mm: number;
  y_mm: number;
  z_mm: number;
  rotation_deg: number;
}

/** 저장된 버전의 배치(스냅샷 포함). 원본 집기가 삭제되면 fixture_id 는 null. */
export interface Placement extends Omit<PlacementInput, "fixture_id"> {
  id: number;
  fixture_id: number | null;
  name: string;
  kind: FixtureKind;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  clearance_mm: number;
  color: string;
  image_url: string | null;
}

export interface VersionSummary {
  version_no: number;
  memo: string | null;
  created_at: string;
  placements_count: number;
}

export interface Version {
  version_no: number;
  memo: string | null;
  created_at: string;
  placements: Placement[];
}

export interface LayoutSummary {
  id: number;
  house_id: number;
  name: string;
}

/** 배치 판정 결과 (설계서 Section 3) */
export interface PlacementViolation {
  placement_index: number;
  reasons: string[]; // "overlap:<index>" | "wall:<wall_id>" | "door:<opening_id>" | "out_of_bounds" | "fixture_missing"
}

/** 도면 판정 결과 */
export interface PlanViolation {
  code: string;
  message: string;
  path: string | null;
}
