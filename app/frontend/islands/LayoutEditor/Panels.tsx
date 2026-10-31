// 좌측(버전·라이브러리·배치 목록), 우측 플로팅(선택 집기), 하단(메모·저장) 패널.
import type { FixtureKind } from "~/types/domain";
import { filteredFixtures, useLayoutEditor, violationsByIndex } from "./store";

const KIND_LABEL: Record<FixtureKind, string> = {
  furniture: "가구",
  appliance: "가전",
  etc: "기타",
};

function reasonLabel(reason: string, names: readonly string[]): string {
  if (reason === "out_of_bounds") return "외곽 이탈";
  if (reason === "fixture_missing") return "삭제된 집기";
  if (reason.startsWith("wall:")) return `벽 ${reason.slice(5)} 침범`;
  if (reason.startsWith("overlap:"))
    return `${names[Number(reason.slice(8))] ?? "?"} 와 겹침`;
  return reason;
}

export function LeftPanel() {
  const versions = useLayoutEditor((s) => s.versions);
  const baseVersionNo = useLayoutEditor((s) => s.baseVersionNo);
  const switchVersion = useLayoutEditor((s) => s.switchVersion);
  const readOnly = useLayoutEditor((s) => s.readOnly);
  const fixtures = useLayoutEditor((s) => s.fixtures);
  const query = useLayoutEditor((s) => s.query);
  const kindFilter = useLayoutEditor((s) => s.kindFilter);
  const setQuery = useLayoutEditor((s) => s.setQuery);
  const setKindFilter = useLayoutEditor((s) => s.setKindFilter);
  const addFixture = useLayoutEditor((s) => s.addFixture);
  const working = useLayoutEditor((s) => s.working);
  const selectedKey = useLayoutEditor((s) => s.selectedKey);
  const select = useLayoutEditor((s) => s.select);
  const violations = useLayoutEditor((s) => s.violations);
  const byIndex = violationsByIndex(violations);
  const names = working.map((w) => w.name);
  const library = filteredFixtures({ fixtures, query, kindFilter });

  return (
    <aside className="editor__sidebar">
      <section className="tool-group">
        <h2 className="tool-group__title">버전</h2>
        <label className="field">
          <span>기준 버전</span>
          <select
            value={baseVersionNo ?? ""}
            onChange={(e) => void switchVersion(Number(e.target.value))}
            disabled={versions.length === 0}
            aria-label="기준 버전"
          >
            {versions.length === 0 && (
              <option value="">저장된 버전 없음</option>
            )}
            {versions.map((v) => (
              <option key={v.version_no} value={v.version_no}>
                v{v.version_no} · 집기 {v.placements_count}개
                {v.memo ? ` · ${v.memo}` : ""}
              </option>
            ))}
          </select>
        </label>
        {readOnly && (
          <p className="field__hint">읽기 전용으로 보는 중입니다.</p>
        )}
      </section>

      <section className="tool-group">
        <h2 className="tool-group__title">집기 라이브러리</h2>
        <label className="field">
          <span className="visually-hidden">검색</span>
          <input
            type="search"
            placeholder="이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="집기 검색"
          />
        </label>
        <div className="tool-buttons" role="radiogroup" aria-label="종류">
          <button
            type="button"
            role="radio"
            aria-checked={kindFilter === null}
            className={`btn btn--small ${kindFilter === null ? "btn--primary" : ""}`}
            onClick={() => setKindFilter(null)}
          >
            전체
          </button>
          {(Object.keys(KIND_LABEL) as FixtureKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={kindFilter === kind}
              className={`btn btn--small ${kindFilter === kind ? "btn--primary" : ""}`}
              onClick={() => setKindFilter(kind)}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <ul className="list" aria-label="집기 라이브러리">
          {library.map((f) => (
            <li key={f.id} className="list__item">
              <span
                className="list__swatch"
                style={{ background: f.color }}
                aria-hidden="true"
              />
              <span className="list__body">
                <span className="list__title">{f.name}</span>
                <span className="list__meta mono">
                  {f.width_mm.toLocaleString()} × {f.depth_mm.toLocaleString()}{" "}
                  × {f.height_mm.toLocaleString()} mm
                </span>
              </span>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => addFixture(f.id)}
                disabled={readOnly}
                aria-label={`${f.name} 추가`}
              >
                추가
              </button>
            </li>
          ))}
          {library.length === 0 && (
            <li className="muted small">해당하는 집기가 없습니다.</li>
          )}
        </ul>
      </section>

      <section className="tool-group">
        <h2 className="tool-group__title">배치된 집기 {working.length}개</h2>
        <ul className="list" aria-label="배치된 집기">
          {working.map((w, index) => {
            const reasons = byIndex.get(index);
            return (
              <li
                key={w.key}
                className={`list__item list__item--clickable ${w.key === selectedKey ? "list__item--selected" : ""}`}
              >
                <button
                  type="button"
                  className="list__select"
                  onClick={() => select(w.key)}
                >
                  <span
                    className="list__swatch"
                    style={{ background: w.color }}
                    aria-hidden="true"
                  />
                  <span className="list__body">
                    <span className="list__title">{w.name}</span>
                    <span className="list__meta mono">
                      ({w.x_mm.toLocaleString()}, {w.y_mm.toLocaleString()}){" "}
                      {w.rotation_deg}°
                    </span>
                  </span>
                  {reasons ? (
                    <span
                      className="badge badge--danger"
                      title={reasons
                        .map((r) => reasonLabel(r, names))
                        .join(", ")}
                    >
                      충돌
                    </span>
                  ) : (
                    <span className="badge badge--valid">OK</span>
                  )}
                </button>
              </li>
            );
          })}
          {working.length === 0 && (
            <li className="muted small">
              라이브러리에서 "추가"를 눌러 배치를 시작하세요.
            </li>
          )}
        </ul>
      </section>
    </aside>
  );
}

export function Inspector() {
  const working = useLayoutEditor((s) => s.working);
  const selectedKey = useLayoutEditor((s) => s.selectedKey);
  const setPosition = useLayoutEditor((s) => s.setPosition);
  const setRotation = useLayoutEditor((s) => s.setRotation);
  const rotateBy = useLayoutEditor((s) => s.rotateBy);
  const remove = useLayoutEditor((s) => s.remove);
  const readOnly = useLayoutEditor((s) => s.readOnly);
  const violations = useLayoutEditor((s) => s.violations);
  const index = working.findIndex((w) => w.key === selectedKey);
  const target = working[index];
  if (!target) return null;
  const reasons = violationsByIndex(violations).get(index) ?? [];
  const names = working.map((w) => w.name);

  return (
    <div className="inspector" role="region" aria-label="선택 집기">
      <p className="inspector__title">{target.name}</p>
      <p className="mono small muted">
        {target.width_mm.toLocaleString()} × {target.depth_mm.toLocaleString()}{" "}
        × {target.height_mm.toLocaleString()} mm
      </p>
      {reasons.length > 0 && (
        <p className="text-danger small">
          {reasons.map((r) => reasonLabel(r, names)).join(", ")}
        </p>
      )}
      <div className="form__row form__row--2">
        <label className="field">
          <span>X (mm)</span>
          <input
            type="number"
            step={10}
            value={target.x_mm}
            disabled={readOnly}
            onChange={(e) =>
              setPosition(target.key, Number(e.target.value), target.y_mm)
            }
          />
        </label>
        <label className="field">
          <span>Y (mm)</span>
          <input
            type="number"
            step={10}
            value={target.y_mm}
            disabled={readOnly}
            onChange={(e) =>
              setPosition(target.key, target.x_mm, Number(e.target.value))
            }
          />
        </label>
      </div>
      <label className="field">
        <span>회전 (°)</span>
        <input
          type="number"
          step={1}
          min={0}
          max={359}
          value={target.rotation_deg}
          disabled={readOnly}
          onChange={(e) => setRotation(target.key, Number(e.target.value))}
        />
      </label>
      <div className="form__actions">
        <button
          type="button"
          className="btn btn--small"
          disabled={readOnly}
          onClick={() => rotateBy(target.key, 90)}
        >
          90° 회전
        </button>
        <button
          type="button"
          className="btn btn--small btn--danger"
          disabled={readOnly}
          onClick={() => remove(target.key)}
        >
          제거
        </button>
      </div>
      <p className="field__hint">
        드래그 이동(10 mm 스냅) · 방향키 10 mm, Shift 100 mm · R 회전 · Delete
        제거
      </p>
    </div>
  );
}

export function SaveBar() {
  const memo = useLayoutEditor((s) => s.memo);
  const setMemo = useLayoutEditor((s) => s.setMemo);
  const save = useLayoutEditor((s) => s.save);
  const saving = useLayoutEditor((s) => s.saving);
  const dirty = useLayoutEditor((s) => s.dirty);
  const readOnly = useLayoutEditor((s) => s.readOnly);
  const violations = useLayoutEditor((s) => s.violations);
  const working = useLayoutEditor((s) => s.working);
  const baseVersionNo = useLayoutEditor((s) => s.baseVersionNo);
  const startEditing = useLayoutEditor((s) => s.startEditingFromCurrent);
  const viewOnly = useLayoutEditor((s) => s.viewOnly);

  const collisions = violations.length;
  return (
    <div className="savebar">
      <span className="small muted">
        기준 {baseVersionNo ? `v${baseVersionNo}` : "없음"}
      </span>
      {collisions > 0 ? (
        <span className="badge badge--danger">충돌 {collisions}개</span>
      ) : (
        <span className="badge badge--valid">이상 없음</span>
      )}
      {dirty && <span className="badge">미저장</span>}
      {viewOnly ? (
        <span className="small muted">보기 전용</span>
      ) : readOnly ? (
        <button
          type="button"
          className="btn btn--primary"
          onClick={startEditing}
        >
          이 버전에서 이어서 편집
        </button>
      ) : (
        <>
          <input
            type="text"
            className="savebar__memo"
            placeholder="메모 (선택, 200자)"
            maxLength={200}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            aria-label="메모"
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void save()}
            disabled={
              saving ||
              collisions > 0 ||
              working.some((w) => w.fixture_id === null)
            }
          >
            {saving ? "저장 중…" : "새 버전으로 저장"}
          </button>
        </>
      )}
    </div>
  );
}
