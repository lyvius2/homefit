// S-03 도면 에디터 섬. props: { house_id }
import { useEffect } from "react";
import { MOBILE_QUERY, useMediaQuery } from "~/lib/useMediaQuery";
import Canvas from "./Canvas";
import Sidebar from "./Sidebar";
import { usePlanEditor } from "./store";

interface Props {
  house_id?: unknown;
}

export default function PlanEditor(props: Props) {
  const houseId = Number(props.house_id);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const load = usePlanEditor((s) => s.load);
  const loading = usePlanEditor((s) => s.loading);
  const loadError = usePlanEditor((s) => s.loadError);
  const plan = usePlanEditor((s) => s.plan);
  const dirty = usePlanEditor((s) => s.dirty);
  const notice = usePlanEditor((s) => s.notice);
  const violations = usePlanEditor((s) => s.violations);
  const deleteSelected = usePlanEditor((s) => s.deleteSelected);
  const cancelPending = usePlanEditor((s) => s.cancelPending);

  useEffect(() => {
    if (Number.isFinite(houseId)) void load(houseId, mobile);
  }, [houseId, mobile, load]);

  // 키보드: Delete/Backspace 선택 벽 삭제, Esc 그리기 끊기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if (e.key === "Escape") cancelPending();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, cancelPending]);

  // 미저장 변경이 있으면 떠나기 전에 경고
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onTurbo = (e: Event) => {
      if (
        !window.confirm("저장하지 않은 변경이 있습니다. 이 페이지를 떠날까요?")
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("turbo:before-visit", onTurbo);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("turbo:before-visit", onTurbo);
    };
  }, [dirty]);

  if (!Number.isFinite(houseId))
    return <p className="flash flash--alert">house_id 가 없습니다.</p>;
  if (loadError)
    return (
      <p className="flash flash--alert">불러오지 못했습니다: {loadError}</p>
    );
  if (loading || !plan) return <p className="muted">도면을 불러오는 중…</p>;

  return (
    <div className="editor">
      <Sidebar />
      <div className="editor__main">
        {mobile && (
          <p className="banner banner--info" role="status">
            모바일에서는 보기 전용입니다. 편집은 1024 px 이상 화면에서 하세요.
          </p>
        )}
        {violations.length > 0 && (
          <div className="banner banner--error" role="alert">
            <strong>저장할 수 없습니다.</strong>
            <ul>
              {violations.map((v, i) => (
                <li key={i}>
                  {v.message}
                  {v.path && <span className="mono muted"> ({v.path})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {notice && (
          <p className="banner banner--info" role="status">
            {notice}
          </p>
        )}
        <Canvas />
      </div>
    </div>
  );
}
