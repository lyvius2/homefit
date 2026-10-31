// 좌표계 매핑은 이 파일 한 곳에만 둔다 (AGENTS.md, R-02).
//
// 도면(2D): 원점 = 도면 좌상단, x 오른쪽 +, y 아래 +, 단위 정수 mm.
// 3D(three.js): x → x, y_mm → z, 높이 → y. 1 unit = 1 m (mm / 1000).
// 회전: 위에서 봤을 때 시계방향 deg → three.js 의 y 축 회전은 반시계가 + 이므로 부호를 뒤집는다.

export const MM_PER_UNIT = 1000;

export type Vec3 = [number, number, number];

export function mmToUnit(mm: number): number {
  return mm / MM_PER_UNIT;
}

export function unitToMm(unit: number): number {
  return Math.round(unit * MM_PER_UNIT);
}

/** 도면 (x_mm, y_mm) + 바닥에서 띄운 z_mm → three.js [x, y, z] */
export function planToScene(x_mm: number, y_mm: number, z_mm = 0): Vec3 {
  return [mmToUnit(x_mm), mmToUnit(z_mm), mmToUnit(y_mm)];
}

/** three.js 바닥 평면의 (x, z) → 도면 (x_mm, y_mm) */
export function sceneToPlan(x: number, z: number): [number, number] {
  return [unitToMm(x), unitToMm(z)];
}

/** 시계방향 도 → three.js y 축 회전(라디안, 반시계 +) */
export function rotationDegToSceneY(rotation_deg: number): number {
  return (-rotation_deg * Math.PI) / 180;
}

/** 0–359 로 정규화 (R-01) */
export function normalizeDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** step mm 단위로 스냅 (기본 10 mm, 설계서 S-06) */
export function snapMm(mm: number, step = 10): number {
  return Math.round(mm / step) * step;
}
