import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(body === undefined ? "" : JSON.stringify(body), {
        status,
        statusText: status === 500 ? "Internal Server Error" : "",
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("unwraps the data envelope and sends JSON with the CSRF header", async () => {
    const fetchMock = mockFetch(201, {
      data: { version_no: 3, created_at: "2026-11-01T00:00:00.000Z" },
    });

    const result = await api.createVersion(7, "메모", [
      { fixture_id: 1, x_mm: 10, y_mm: 20, z_mm: 0, rotation_deg: 90 },
    ]);

    expect(result.version_no).toBe(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/v1/layouts/7/versions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      memo: "메모",
      placements: [
        { fixture_id: 1, x_mm: 10, y_mm: 20, z_mm: 0, rotation_deg: 90 },
      ],
    });
  });

  it("throws ApiError with code and details from the error envelope", async () => {
    mockFetch(422, {
      error: {
        code: "collision",
        message: "겹침",
        details: {
          violations: [{ placement_index: 0, reasons: ["wall:w01"] }],
        },
      },
    });

    const error = await api.createVersion(7, null, []).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.code).toBe("collision");
    expect(apiError.details).toEqual({
      violations: [{ placement_index: 0, reasons: ["wall:w01"] }],
    });
  });

  it("maps non-JSON failures to http_<status>", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("boom", {
            status: 500,
            statusText: "Internal Server Error",
          }),
        ),
      ),
    );

    const error = (await api.getPlan(1).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe("http_500");
  });

  it("encodes the kind filter", async () => {
    const fetchMock = mockFetch(200, { data: [] });
    await api.listFixtures("appliance");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      "/api/v1/fixtures?kind=appliance",
    );
  });
});
