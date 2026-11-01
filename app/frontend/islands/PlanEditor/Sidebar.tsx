// 좌측 도구 패널: 축척·검증, 벽 그리기/선택/삭제, 두께, 직각 스냅, 문 놓기·편집, 저장/검증, 상태.
import { wallLength } from "./planMath";
import { renderPxPerMm, usePlanEditor, type Tool } from "./store";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  {
    id: "select",
    label: "선택",
    hint: "벽이나 문을 클릭해 선택. Delete 로 삭제",
  },
  {
    id: "wall",
    label: "벽 그리기",
    hint: "클릭 → 클릭으로 벽을 잇는다. Esc 로 끊기",
  },
  {
    id: "door",
    label: "문 놓기",
    hint: "벽 가까이를 클릭해 여닫이문을 놓는다. 클릭한 쪽으로 열린다",
  },
  {
    id: "scale",
    label: "축척",
    hint: "실제 길이를 입력하고 도면 위 두 점을 클릭",
  },
  {
    id: "verify",
    label: "검증 측정",
    hint: "다른 치수로 축척이 맞는지 확인 (오차 3% 이내)",
  },
];

export default function Sidebar() {
  const house = usePlanEditor((s) => s.house);
  const plan = usePlanEditor((s) => s.plan);
  const tool = usePlanEditor((s) => s.tool);
  const setTool = usePlanEditor((s) => s.setTool);
  const thickness = usePlanEditor((s) => s.thickness_mm);
  const setThickness = usePlanEditor((s) => s.setThickness);
  const rightAngle = usePlanEditor((s) => s.rightAngle);
  const toggleRightAngle = usePlanEditor((s) => s.toggleRightAngle);
  const measureMm = usePlanEditor((s) => s.measureMm);
  const setMeasureMm = usePlanEditor((s) => s.setMeasureMm);
  const selectedWallId = usePlanEditor((s) => s.selectedWallId);
  const selectedOpeningId = usePlanEditor((s) => s.selectedOpeningId);
  const deleteSelected = usePlanEditor((s) => s.deleteSelected);
  const setSelectedThickness = usePlanEditor((s) => s.setSelectedThickness);
  const doorWidthMm = usePlanEditor((s) => s.doorWidthMm);
  const setDoorWidth = usePlanEditor((s) => s.setDoorWidth);
  const updateSelectedOpening = usePlanEditor((s) => s.updateSelectedOpening);
  const flipHinge = usePlanEditor((s) => s.flipHinge);
  const flipSide = usePlanEditor((s) => s.flipSide);
  const setDefaultSwing = usePlanEditor((s) => s.setDefaultSwing);
  const clearScale = usePlanEditor((s) => s.clearScale);
  const dirty = usePlanEditor((s) => s.dirty);
  const saving = usePlanEditor((s) => s.saving);
  const save = usePlanEditor((s) => s.save);
  const validate = usePlanEditor((s) => s.validate);
  const pendingPx = usePlanEditor((s) => s.pendingPx);
  const readOnly = usePlanEditor((s) => s.readOnly);

  if (!plan || !house) return null;

  const pxPerMm = renderPxPerMm(plan);
  const hasImage = plan.image !== null;
  const selected = plan.walls.find((w) => w.id === selectedWallId) ?? null;
  const selectedOpening =
    plan.openings.find((o) => o.id === selectedOpeningId) ?? null;
  const selectedOpeningWall = selectedOpening
    ? (plan.walls.find((w) => w.id === selectedOpening.wall_id) ?? null)
    : null;
  const doorCount = plan.openings.filter((o) => o.type === "door").length;
  const verify = plan.scale.verify;

  return (
    <aside className="editor__sidebar">
      <section className="tool-group">
        <h2 className="tool-group__title">도구</h2>
        <div className="tool-buttons" role="radiogroup" aria-label="도구">
          {TOOLS.map((t) => {
            const disabled = readOnly
              ? t.id !== "select"
              : (t.id === "wall" || t.id === "door" || t.id === "verify") &&
                !pxPerMm;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tool === t.id}
                className={`btn btn--small ${tool === t.id ? "btn--primary" : ""}`}
                disabled={disabled}
                title={t.hint}
                onClick={() => setTool(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="field__hint">{TOOLS.find((t) => t.id === tool)?.hint}</p>
      </section>

      {(tool === "scale" || tool === "verify") && (
        <section className="tool-group">
          <h2 className="tool-group__title">
            {tool === "scale" ? "축척 설정" : "검증 측정"}
          </h2>
          <label className="field">
            <span>실제 길이 (mm)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={measureMm ?? ""}
              onChange={(e) =>
                setMeasureMm(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="예: 3600"
            />
          </label>
          <p className="field__hint">
            {pendingPx
              ? "두 번째 점을 클릭하세요."
              : "도면에서 이 길이의 시작점을 클릭하세요."}
            {!hasImage &&
              tool === "scale" &&
              " (도면 이미지가 없으면 축척 없이 100 mm 격자에 그립니다)"}
          </p>
        </section>
      )}

      <section className="tool-group">
        <h2 className="tool-group__title">축척</h2>
        {plan.scale.px_per_mm ? (
          <dl className="kv">
            <dt>px/mm</dt>
            <dd className="mono">{plan.scale.px_per_mm}</dd>
            <dt>기준 치수</dt>
            <dd className="mono">
              {plan.scale.measured_mm?.toLocaleString()} mm
            </dd>
            <dt>검증</dt>
            <dd className="mono">
              {verify ? (
                <span
                  className={
                    verify.error_pct > 3 ? "text-danger" : "text-success"
                  }
                >
                  {verify.got_mm.toLocaleString()} mm (오차 {verify.error_pct}%)
                </span>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        ) : (
          <p className="field__hint">
            {hasImage
              ? "아직 축척이 없습니다. 도면 이미지를 쓰려면 필수입니다."
              : "도면 없음 · 1 px = 10 mm 격자"}
          </p>
        )}
        {plan.scale.px_per_mm && (
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={clearScale}
          >
            축척 다시 잡기
          </button>
        )}
      </section>

      <section className="tool-group">
        <h2 className="tool-group__title">벽 {plan.walls.length}개</h2>
        <label className="field">
          <span>새 벽 두께 (mm)</span>
          <input
            type="number"
            min={1}
            step={10}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={rightAngle}
            onChange={toggleRightAngle}
          />{" "}
          직각 스냅
        </label>

        {selected && (
          <div className="selected-wall">
            <p className="mono">
              {selected.id} · {wallLength(selected).toLocaleString()} mm
            </p>
            <label className="field">
              <span>두께 (mm)</span>
              <input
                type="number"
                min={1}
                step={10}
                value={selected.thickness_mm}
                onChange={(e) => setSelectedThickness(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn btn--small btn--danger"
              onClick={deleteSelected}
            >
              벽 삭제
            </button>
          </div>
        )}
      </section>

      <section className="tool-group">
        <h2 className="tool-group__title">문 {doorCount}개</h2>
        {tool === "door" && (
          <label className="field">
            <span>새 문 폭 (mm)</span>
            <input
              type="number"
              min={1}
              step={10}
              value={doorWidthMm}
              onChange={(e) => setDoorWidth(Number(e.target.value))}
            />
          </label>
        )}
        {selectedOpening ? (
          <div className="selected-wall">
            <p className="mono">
              {selectedOpening.id} ·{" "}
              {selectedOpening.type === "door" ? "문" : "창"} · 벽{" "}
              {selectedOpening.wall_id}
              {selectedOpeningWall &&
                ` (${wallLength(selectedOpeningWall).toLocaleString()} mm)`}
            </p>
            <label className="field">
              <span>벽 시작점에서 (mm)</span>
              <input
                type="number"
                min={0}
                step={10}
                value={selectedOpening.offset_mm}
                disabled={readOnly}
                onChange={(e) =>
                  updateSelectedOpening({ offset_mm: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>폭 (mm)</span>
              <input
                type="number"
                min={1}
                step={10}
                value={selectedOpening.width_mm}
                disabled={readOnly}
                onChange={(e) =>
                  updateSelectedOpening({ width_mm: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>높이 (mm)</span>
              <input
                type="number"
                min={1}
                step={10}
                value={selectedOpening.height_mm}
                disabled={readOnly}
                onChange={(e) =>
                  updateSelectedOpening({ height_mm: Number(e.target.value) })
                }
              />
            </label>
            {selectedOpening.type === "door" &&
              (selectedOpening.swing ? (
                <div className="tool-buttons">
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={readOnly}
                    onClick={flipHinge}
                  >
                    경첩 반전 (
                    {selectedOpening.swing.hinge === "a" ? "시작" : "끝"}
                    쪽)
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={readOnly}
                    onClick={flipSide}
                  >
                    열림 방향 반전 (
                    {selectedOpening.swing.side === "left" ? "왼쪽" : "오른쪽"})
                  </button>
                </div>
              ) : (
                <p className="field__hint">
                  열림 방향이 없는 문입니다. 배치도에서 열림 영역을 판정하려면
                  설정하세요.{" "}
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={readOnly}
                    onClick={setDefaultSwing}
                  >
                    열림 방향 설정
                  </button>
                </p>
              ))}
            <button
              type="button"
              className="btn btn--small btn--danger"
              disabled={readOnly}
              onClick={deleteSelected}
            >
              {selectedOpening.type === "door" ? "문 삭제" : "창 삭제"}
            </button>
          </div>
        ) : (
          <p className="field__hint">
            문 놓기 도구로 벽을 클릭하면 문이 생깁니다. 배치도에서 열림 부채꼴에
            집기가 들어가면 충돌로 봅니다.
          </p>
        )}
      </section>

      <section className="tool-group tool-group--actions">
        <span className={`badge badge--${house.plan_status}`}>
          {house.plan_status === "valid" ? "검증됨" : "초안"}
        </span>
        {dirty && <span className="badge">미저장</span>}
        <button
          type="button"
          className="btn"
          onClick={() => void validate()}
          disabled={saving}
        >
          검사
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void save()}
          disabled={saving || !dirty}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </section>
    </aside>
  );
}
