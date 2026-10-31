// 집기 1개: BoxGeometry + 6면 머티리얼(정면 +z 에 텍스처). 바닥 평면 위 드래그(10 mm 스냅), 선택 강조, 충돌 빨강.
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BoxGeometry, EdgesGeometry, Plane, Vector3 } from "three";
import {
  mmToUnit,
  planToScene,
  rotationDegToSceneY,
  sceneToPlan,
} from "~/lib/coords";
import { useTexture } from "~/lib/useTexture";
import { useLayoutEditor, type WorkingPlacement } from "./store";

interface Props {
  placement: WorkingPlacement;
  selected: boolean;
  violated: boolean;
}

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
const SELECTED = "#2563eb";
const VIOLATED = "#dc2626";

export default function FixtureMesh({ placement, selected, violated }: Props) {
  const select = useLayoutEditor((s) => s.select);
  const setPosition = useLayoutEditor((s) => s.setPosition);
  const setDragging = useLayoutEditor((s) => s.setDragging);
  const readOnly = useLayoutEditor((s) => s.readOnly);
  const texture = useTexture(placement.image_url);

  const w = mmToUnit(placement.width_mm);
  const d = mmToUnit(placement.depth_mm);
  const h = mmToUnit(placement.height_mm);
  const [x, , z] = planToScene(placement.x_mm, placement.y_mm, placement.z_mm);
  const y = mmToUnit(placement.z_mm) + h / 2;

  // 드래그 시작 시 포인터가 잡은 바닥 점과 중심의 차이 (mm). 잡은 자리를 유지한 채 끌기 위해서
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const hit = useRef(new Vector3());

  const clearanceEdges = useMemo(() => {
    if (placement.clearance_mm <= 0) return null;
    const c = mmToUnit(placement.clearance_mm);
    return new EdgesGeometry(new BoxGeometry(w + 2 * c, 0.002, d + 2 * c));
  }, [w, d, placement.clearance_mm]);

  const floorPoint = (e: ThreeEvent<PointerEvent>): [number, number] | null => {
    if (!e.ray.intersectPlane(FLOOR, hit.current)) return null;
    return sceneToPlan(hit.current.x, hit.current.z);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(placement.key);
    if (readOnly) return;
    const point = floorPoint(e);
    if (!point) return;
    grab.current = {
      dx: point[0] - placement.x_mm,
      dy: point[1] - placement.y_mm,
    };
    // R3F 리스너가 OrbitControls 보다 먼저 등록되어 있으므로, 여기서 네이티브 전파를 끊으면 카메라가 돌지 않는다
    e.nativeEvent.stopImmediatePropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    const point = floorPoint(e);
    if (!point) return;
    setPosition(
      placement.key,
      point[0] - grab.current.dx,
      point[1] - grab.current.dy,
    );
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    grab.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const color = violated ? VIOLATED : placement.color;
  const emissive = selected ? SELECTED : violated ? VIOLATED : "#000000";
  const emissiveIntensity = selected ? 0.35 : violated ? 0.2 : 0;
  const side = { color, emissive, emissiveIntensity };

  return (
    <group
      position={[x, 0, z]}
      rotation-y={rotationDegToSceneY(placement.rotation_deg)}
    >
      <mesh
        position-y={y}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        userData={{ placementKey: placement.key }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial attach="material-0" {...side} />
        <meshStandardMaterial attach="material-1" {...side} />
        <meshStandardMaterial attach="material-2" {...side} />
        <meshStandardMaterial attach="material-3" {...side} />
        {/* +z = 정면: 텍스처가 있으면 흰 바탕에 이미지 */}
        <meshStandardMaterial
          attach="material-4"
          color={texture && !violated ? "#ffffff" : color}
          map={texture ?? null}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
        <meshStandardMaterial attach="material-5" {...side} />
      </mesh>
      {clearanceEdges && (
        <lineSegments geometry={clearanceEdges} position-y={0.003}>
          <lineBasicMaterial color="#9ca3af" />
        </lineSegments>
      )}
    </group>
  );
}
