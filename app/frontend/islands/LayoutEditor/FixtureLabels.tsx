// 집기 이름 라벨. 캔버스 위에 겹친 DOM 오버레이 하나에 span 을 두고, 캔버스 안의 projector 가 매 프레임
// 3D 앵커(박스 윗면 + 60 mm)를 화면 좌표로 투영해 transform 을 직접 쓴다.
// drei <Html> 은 라벨마다 React 루트를 따로 만드는데 React 19 에서 첫 인스턴스의 루트가 깨지는 경합
// ("Attempted to synchronously unmount a root while React was already rendering") 이 있어 쓰지 않는다 (ADR 0004).
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { mmToUnit, planToScene } from "~/lib/coords";
import type { WorkingPlacement } from "./store";

const LABEL_GAP_MM = 60;
/** drei Html 의 distanceFactor 와 같은 의미: 이 거리(m)에서 1배, 멀어지면 작아진다 */
const DISTANCE_FACTOR = 10;
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.1;

export type LabelElements = Map<string, HTMLSpanElement>;

interface OverlayProps {
  working: readonly WorkingPlacement[];
  selectedKey: string | null;
  violatedIndexes: ReadonlyMap<number, unknown>;
  elements: RefObject<LabelElements>;
}

/** 캔버스 밖(같은 stage div 안)에 두는 오버레이. 포인터 이벤트를 받지 않아 드래그·선택을 막지 않는다 */
export function FixtureLabelOverlay({
  working,
  selectedKey,
  violatedIndexes,
  elements,
}: OverlayProps) {
  return (
    <div className="fixture-labels">
      {working.map((placement, index) => {
        const className = [
          "fixture-label",
          placement.key === selectedKey ? "fixture-label--selected" : "",
          violatedIndexes.has(index) ? "fixture-label--violated" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span
            key={placement.key}
            className={className}
            ref={(el) => {
              if (el) elements.current.set(placement.key, el);
              else elements.current.delete(placement.key);
            }}
          >
            {placement.name}
          </span>
        );
      })}
    </div>
  );
}

interface ProjectorProps {
  working: readonly WorkingPlacement[];
  elements: RefObject<LabelElements>;
}

/** 캔버스 안에서 매 프레임 라벨 위치를 갱신한다. 렌더 트리에는 아무것도 그리지 않는다 */
export function FixtureLabelProjector({ working, elements }: ProjectorProps) {
  const anchor = useRef(new Vector3());

  useFrame(({ camera, size }) => {
    const fovScale =
      camera instanceof PerspectiveCamera
        ? 2 * Math.tan((camera.fov * Math.PI) / 360)
        : null;

    for (const placement of working) {
      const el = elements.current.get(placement.key);
      if (!el) continue;

      const [x, , z] = planToScene(placement.x_mm, placement.y_mm);
      const top = mmToUnit(placement.z_mm + placement.height_mm + LABEL_GAP_MM);
      const v = anchor.current.set(x, top, z);
      const distance = v.distanceTo(camera.position);
      v.project(camera);

      // 카메라 뒤(NDC z > 1)면 숨긴다
      if (v.z > 1) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "";

      const px = ((v.x + 1) / 2) * size.width;
      const py = ((1 - v.y) / 2) * size.height;
      const scale =
        fovScale === null
          ? 1
          : Math.min(
              MAX_SCALE,
              Math.max(MIN_SCALE, DISTANCE_FACTOR / (fovScale * distance)),
            );
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
    }
  });

  return null;
}
