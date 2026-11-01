// 집기 1개: BoxGeometry + 6면 머티리얼(옆면 4면에 텍스처, 윗면·바닥은 색). 이름 라벨은 FixtureLabels.tsx.
// 바닥 평면 위 드래그(10 mm 스냅), Ctrl(⌘)+드래그는 높이(z_mm) 이동, 선택 강조, 충돌 빨강.
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BoxGeometry,
  EdgesGeometry,
  PerspectiveCamera,
  Plane,
  Vector3,
} from "three";
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
  const setElevation = useLayoutEditor((s) => s.setElevation);
  const settle = useLayoutEditor((s) => s.settle);
  const setDragging = useLayoutEditor((s) => s.setDragging);
  const readOnly = useLayoutEditor((s) => s.readOnly);
  const viewportHeight = useThree((s) => s.size.height);
  const texture = useTexture(placement.image_url);

  const w = mmToUnit(placement.width_mm);
  const d = mmToUnit(placement.depth_mm);
  const h = mmToUnit(placement.height_mm);
  const [x, , z] = planToScene(placement.x_mm, placement.y_mm, placement.z_mm);
  const y = mmToUnit(placement.z_mm) + h / 2;

  // 드래그 상태. move: 포인터가 잡은 바닥 점과 중심의 차이(mm)를 유지한 채 끈다.
  // elevate(Ctrl/⌘): 카메라를 마주 보는 수직 평면 위에서 포인터의 높이를 따라간다. 카메라가 거의 수직이면 픽셀 기준.
  const grab = useRef<
    | { mode: "move"; dx: number; dy: number }
    | {
        mode: "elevate";
        plane: Plane | null;
        dz: number;
        startClientY: number;
        startZ: number;
        mmPerPx: number;
      }
    | null
  >(null);
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
    if (e.ctrlKey || e.metaKey) {
      grab.current = startElevate(e);
    } else {
      const point = floorPoint(e);
      if (!point) return;
      grab.current = {
        mode: "move",
        dx: point[0] - placement.x_mm,
        dy: point[1] - placement.y_mm,
      };
    }
    // R3F 리스너가 OrbitControls 보다 먼저 등록되어 있으므로, 여기서 네이티브 전파를 끊으면 카메라가 돌지 않는다
    e.nativeEvent.stopImmediatePropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  // 집기 중심을 지나고 카메라 쪽을 향하는 수직 평면. 포인터 광선과의 교점 y 가 곧 높이.
  const startElevate = (e: ThreeEvent<PointerEvent>) => {
    const forward = e.camera.getWorldDirection(new Vector3());
    forward.y = 0;
    const center = new Vector3(x, y, z);
    const distance = center.distanceTo(e.camera.position);
    const fovScale =
      e.camera instanceof PerspectiveCamera
        ? 2 * Math.tan((e.camera.fov * Math.PI) / 360)
        : 1;
    const mmPerPx = (fovScale * distance * 1000) / viewportHeight;
    const usePlane = forward.length() > 0.2;
    const plane = usePlane
      ? new Plane().setFromNormalAndCoplanarPoint(forward.normalize(), center)
      : null;
    let dz = 0;
    if (plane && e.ray.intersectPlane(plane, hit.current)) {
      dz = hit.current.y * 1000 - placement.z_mm;
    }
    return {
      mode: "elevate" as const,
      plane,
      dz,
      startClientY: e.nativeEvent.clientY,
      startZ: placement.z_mm,
      mmPerPx,
    };
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    if (!g) return;
    if (g.mode === "elevate") {
      if (g.plane && e.ray.intersectPlane(g.plane, hit.current)) {
        setElevation(placement.key, hit.current.y * 1000 - g.dz);
      } else {
        const deltaPx = g.startClientY - e.nativeEvent.clientY;
        setElevation(placement.key, g.startZ + deltaPx * g.mmPerPx);
      }
      return;
    }
    const point = floorPoint(e);
    if (!point) return;
    setPosition(placement.key, point[0] - g.dx, point[1] - g.dy);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
    // 평면 드래그로 놓으면 아래 집기 위(없으면 바닥)에 올린다. 높이 드래그(Ctrl)는 그대로 둔다
    if (g.mode === "move") settle(placement.key);
    setDragging(false);
  };

  const color = violated ? VIOLATED : placement.color;
  const emissive = selected ? SELECTED : violated ? VIOLATED : "#000000";
  const emissiveIntensity = selected ? 0.35 : violated ? 0.2 : 0;
  // 윗면(+y)·바닥(−y): 항상 색. 옆면 4면: 이미지가 있으면 흰 바탕에 텍스처, 충돌이면 빨갛게 물들인다 (ADR 0004)
  const cap = { color, emissive, emissiveIntensity };
  const side = {
    color: texture && !violated ? "#ffffff" : color,
    map: texture ?? null,
    emissive,
    emissiveIntensity,
  };

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
        {/* BoxGeometry 면 순서: 0 +x, 1 −x, 2 +y(윗면), 3 −y(바닥), 4 +z(정면), 5 −z */}
        <meshStandardMaterial attach="material-0" {...side} />
        <meshStandardMaterial attach="material-1" {...side} />
        <meshStandardMaterial attach="material-2" {...cap} />
        <meshStandardMaterial attach="material-3" {...cap} />
        <meshStandardMaterial attach="material-4" {...side} />
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
