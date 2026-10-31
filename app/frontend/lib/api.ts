// /api/v1 fetch 래퍼. 같은 세션 쿠키로 인증하고 CSRF 토큰은 메타 태그에서 읽어 헤더로 보낸다 (설계서 Section 4).
import type {
  Fixture,
  HouseSummary,
  LayoutSummary,
  PlacementInput,
  PlacementViolation,
  Plan,
  PlanStatus,
  PlanViolation,
  Version,
  VersionSummary,
} from "~/types/domain";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

function csrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
      ?.content ?? null
  );
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = csrfToken();
  if (token) headers["X-CSRF-Token"] = token;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(path, {
    method,
    headers,
    body: payload,
    credentials: "same-origin",
  });
  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const error = isErrorEnvelope(json)
      ? json.error
      : { code: `http_${response.status}`, message: response.statusText };
    throw new ApiError(response.status, error);
  }
  if (!isDataEnvelope<T>(json)) {
    throw new ApiError(response.status, {
      code: "bad_response",
      message: "응답 형식이 올바르지 않습니다.",
    });
  }
  return json.data;
}

function isErrorEnvelope(value: unknown): value is { error: ApiErrorBody } {
  if (typeof value !== "object" || value === null || !("error" in value))
    return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

function isDataEnvelope<T>(value: unknown): value is { data: T } {
  return typeof value === "object" && value !== null && "data" in value;
}

// --- 엔드포인트 (설계서 Section 4.2) ---

export interface PlanPayload {
  house: HouseSummary;
  plan: Plan;
  floor_plan_url: string | null;
}

export const api = {
  getPlan: (houseId: number) =>
    request<PlanPayload>("GET", `/api/v1/houses/${houseId}/plan`),

  savePlan: (houseId: number, plan: Plan) =>
    request<{ plan: Plan; plan_status: PlanStatus }>(
      "PUT",
      `/api/v1/houses/${houseId}/plan`,
      { plan },
    ),

  validatePlan: (houseId: number, plan: Plan) =>
    request<{ valid: boolean; violations: PlanViolation[] }>(
      "POST",
      `/api/v1/houses/${houseId}/plan/validate`,
      { plan },
    ),

  uploadFloorPlan: (houseId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{
      floor_plan_url: string;
      width_px: number;
      height_px: number;
    }>("POST", `/api/v1/houses/${houseId}/floor_plan`, form);
  },

  listFixtures: (kind?: string) =>
    request<Fixture[]>(
      "GET",
      kind
        ? `/api/v1/fixtures?kind=${encodeURIComponent(kind)}`
        : "/api/v1/fixtures",
    ),

  getLayout: (layoutId: number) =>
    request<{ layout: LayoutSummary; latest_version_no: number | null }>(
      "GET",
      `/api/v1/layouts/${layoutId}`,
    ),

  listVersions: (layoutId: number) =>
    request<VersionSummary[]>("GET", `/api/v1/layouts/${layoutId}/versions`),

  getLatestVersion: (layoutId: number) =>
    request<Version>("GET", `/api/v1/layouts/${layoutId}/versions/latest`),

  getVersion: (layoutId: number, no: number) =>
    request<Version>("GET", `/api/v1/layouts/${layoutId}/versions/${no}`),

  validatePlacements: (layoutId: number, placements: PlacementInput[]) =>
    request<{ valid: boolean; violations: PlacementViolation[] }>(
      "POST",
      `/api/v1/layouts/${layoutId}/versions/validate`,
      {
        placements,
      },
    ),

  createVersion: (
    layoutId: number,
    memo: string | null,
    placements: PlacementInput[],
  ) =>
    request<{ version_no: number; created_at: string }>(
      "POST",
      `/api/v1/layouts/${layoutId}/versions`,
      {
        memo,
        placements,
      },
    ),
};
