// S-06 배치 에디터 섬. props: { layout_id, version_no?, read_only? }
import { useEffect } from "react";
import { Inspector, LeftPanel, SaveBar } from "./Panels";
import Scene from "./Scene";
import { useLayoutEditor } from "./store";

interface Props {
  layout_id?: unknown;
  version_no?: unknown;
  read_only?: unknown;
}

export default function LayoutEditor(props: Props) {
  const layoutId = Number(props.layout_id);
  const versionNo =
    props.version_no === undefined || props.version_no === null
      ? null
      : Number(props.version_no);
  const readOnly = props.read_only === true || props.read_only === "true";

  const load = useLayoutEditor((s) => s.load);
  const loading = useLayoutEditor((s) => s.loading);
  const loadError = useLayoutEditor((s) => s.loadError);
  const plan = useLayoutEditor((s) => s.plan);
  const dirty = useLayoutEditor((s) => s.dirty);
  const notice = useLayoutEditor((s) => s.notice);
  const serverViolations = useLayoutEditor((s) => s.serverViolations);
  const requestCamera = useLayoutEditor((s) => s.requestCamera);
  const nudgeSelected = useLayoutEditor((s) => s.nudgeSelected);
  const rotateBy = useLayoutEditor((s) => s.rotateBy);
  const remove = useLayoutEditor((s) => s.remove);
  const selectedKey = useLayoutEditor((s) => s.selectedKey);

  useEffect(() => {
    if (Number.isFinite(layoutId)) void load(layoutId, versionNo, readOnly);
  }, [layoutId, versionNo, readOnly, load]);

  // 키보드: 방향키 10/100 mm, R 회전, Delete 제거
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const step = e.shiftKey ? 100 : 10;
      switch (e.key) {
        case "ArrowLeft":
          nudgeSelected(-step, 0);
          break;
        case "ArrowRight":
          nudgeSelected(step, 0);
          break;
        case "ArrowUp":
          nudgeSelected(0, -step);
          break;
        case "ArrowDown":
          nudgeSelected(0, step);
          break;
        case "r":
        case "R":
          if (selectedKey) rotateBy(selectedKey, 90);
          break;
        case "Delete":
        case "Backspace":
          if (selectedKey) remove(selectedKey);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nudgeSelected, rotateBy, remove, selectedKey]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
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

  if (!Number.isFinite(layoutId))
    return <p className="flash flash--alert">layout_id 가 없습니다.</p>;
  if (loadError)
    return (
      <p className="flash flash--alert">불러오지 못했습니다: {loadError}</p>
    );
  if (loading || !plan) return <p className="muted">배치도를 불러오는 중…</p>;

  return (
    <div className="editor editor--layout">
      <LeftPanel />
      <div className="editor__main">
        {serverViolations.length > 0 && (
          <div className="banner banner--error" role="alert">
            <strong>서버 판정에서 거부되었습니다.</strong> 충돌 배지가 붙은
            집기를 옮긴 뒤 다시 저장하세요.
          </div>
        )}
        {notice && (
          <p className="banner banner--info" role="status">
            {notice}
          </p>
        )}
        <div
          className="editor__stage editor__stage--3d"
          data-testid="layout-scene"
        >
          <Scene />
          <div className="camera-buttons">
            <button
              type="button"
              className="btn btn--small"
              onClick={() => requestCamera("top")}
            >
              위에서
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => requestCamera("iso")}
            >
              입체
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => requestCamera("fit")}
            >
              전체
            </button>
          </div>
          <Inspector />
        </div>
        <SaveBar />
      </div>
    </div>
  );
}
