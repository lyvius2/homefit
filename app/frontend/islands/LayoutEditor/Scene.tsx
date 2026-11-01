// R3F 뷰: 바닥·벽(압출)·100 mm 격자·집기 박스·이름 라벨. 카메라 버튼(위에서/입체/전체)은 스토어의 camera 요청을 따른다.
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { boundsOfWalls } from "~/lib/collisions";
import { mmToUnit, planToScene } from "~/lib/coords";
import type { Wall } from "~/types/domain";
import {
  FixtureLabelOverlay,
  FixtureLabelProjector,
  type LabelElements,
} from "./FixtureLabels";
import FixtureMesh from "./FixtureMesh";
import { useLayoutEditor, violationsByIndex } from "./store";

interface Frame {
  cx: number;
  cz: number;
  w: number;
  d: number;
}

function frameOf(walls: readonly Wall[]): Frame {
  const bounds = boundsOfWalls(walls);
  if (!bounds) return { cx: 2, cz: 2, w: 6, d: 6 };
  return {
    cx: mmToUnit((bounds.min_x + bounds.max_x) / 2),
    cz: mmToUnit((bounds.min_y + bounds.max_y) / 2),
    w: mmToUnit(bounds.max_x - bounds.min_x),
    d: mmToUnit(bounds.max_y - bounds.min_y),
  };
}

export default function Scene() {
  const plan = useLayoutEditor((s) => s.plan);
  const walls = useMemo(() => plan?.walls ?? [], [plan]);
  const frame = useMemo(() => frameOf(walls), [walls]);
  const ceiling = mmToUnit(
    useLayoutEditor((s) => s.house?.ceiling_height_mm ?? 2300),
  );
  const working = useLayoutEditor((s) => s.working);
  const selectedKey = useLayoutEditor((s) => s.selectedKey);
  const violations = useLayoutEditor((s) => s.violations);
  const dragging = useLayoutEditor((s) => s.dragging);
  const select = useLayoutEditor((s) => s.select);
  const byIndex = violationsByIndex(violations);
  const gridSize = Math.ceil(Math.max(frame.w, frame.d) + 6);
  const labelElements = useRef<LabelElements>(new Map());

  return (
    <>
      <Canvas
        camera={{
          position: [frame.cx + 6, 7, frame.cz + 9],
          fov: 45,
          near: 0.05,
          far: 200,
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#f3f4f6"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 10, 4]} intensity={1.1} />
        <directionalLight position={[-6, 6, -5]} intensity={0.4} />

        {/* 바닥: 클릭하면 선택 해제 */}
        <mesh
          rotation-x={-Math.PI / 2}
          position={[frame.cx, -0.002, frame.cz]}
          onPointerDown={() => select(null)}
        >
          <planeGeometry args={[gridSize + 20, gridSize + 20]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[frame.cx, -0.001, frame.cz]}>
          <planeGeometry args={[frame.w, frame.d]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <gridHelper
          args={[gridSize, gridSize * 10, "#d1d5db", "#e5e7eb"]}
          position={[frame.cx, 0, frame.cz]}
        />

        {walls.map((wall) => (
          <WallMesh key={wall.id} wall={wall} ceiling={ceiling} />
        ))}

        {working.map((placement, index) => (
          <FixtureMesh
            key={placement.key}
            placement={placement}
            selected={placement.key === selectedKey}
            violated={byIndex.has(index)}
          />
        ))}

        <OrbitControls
          makeDefault
          enabled={!dragging}
          enableDamping={false}
          maxPolarAngle={Math.PI / 2 - 0.02}
          target={[frame.cx, 0, frame.cz]}
        />
        <CameraRig frame={frame} />
        <FixtureLabelProjector working={working} elements={labelElements} />
      </Canvas>
      <FixtureLabelOverlay
        working={working}
        selectedKey={selectedKey}
        violatedIndexes={byIndex}
        elements={labelElements}
      />
    </>
  );
}

/** 벽 선분 a→b, 두께 t → 길이 (L + t) × 천장고 × t 의 박스 (끝단 t/2 연장, 설계서 Section 3) */
function WallMesh({ wall, ceiling }: { wall: Wall; ceiling: number }) {
  const dx = wall.b[0] - wall.a[0];
  const dy = wall.b[1] - wall.a[1];
  const length = mmToUnit(Math.hypot(dx, dy) + wall.thickness_mm);
  const t = mmToUnit(wall.thickness_mm);
  const [x, , z] = planToScene(
    (wall.a[0] + wall.b[0]) / 2,
    (wall.a[1] + wall.b[1]) / 2,
  );
  return (
    <mesh position={[x, ceiling / 2, z]} rotation-y={-Math.atan2(dy, dx)}>
      <boxGeometry args={[length, ceiling, t]} />
      <meshStandardMaterial color="#9ca3af" transparent opacity={0.55} />
    </mesh>
  );
}

/** 스토어의 camera 요청(top/iso/fit)에 맞춰 카메라와 OrbitControls target 을 옮긴다 */
function CameraRig({ frame }: { frame: Frame }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as {
    target: { set: (x: number, y: number, z: number) => void };
    update: () => void;
  } | null;
  const request = useLayoutEditor((s) => s.camera);

  useEffect(() => {
    const span = Math.max(frame.w, frame.d, 3);
    if (request.mode === "top") {
      camera.position.set(frame.cx, span * 1.3 + 1, frame.cz + 0.001);
    } else {
      camera.position.set(
        frame.cx + span * 0.7,
        span * 0.8 + 1,
        frame.cz + span * 0.95,
      );
    }
    camera.lookAt(frame.cx, 0, frame.cz);
    if (controls) {
      controls.target.set(frame.cx, 0, frame.cz);
      controls.update();
    }
  }, [request, frame, camera, controls]);

  return null;
}
