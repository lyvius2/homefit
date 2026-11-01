// Konva 캔버스: 도면 배경(또는 100 mm 격자), 벽, 길이 라벨, 문·창 개구부(여닫이문 열림 부채꼴), 그리기 미리보기, 휠 줌, 우클릭 팬.
// 이벤트는 pointer* 만 쓴다 (AGENTS.md).
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Shape,
  Stage,
  Text,
} from "react-konva";
import { doorZone } from "~/lib/geometry";
import { useImage } from "~/lib/useImage";
import type { Opening, Wall } from "~/types/domain";
import {
  mmToPx,
  placeDoor,
  pointPxToMm,
  snapRightAngle,
  snapToEndpoints,
  snapToGrid,
  wallLength,
  zoomAt,
  type Pt,
} from "./planMath";
import { renderPxPerMm, usePlanEditor } from "./store";

interface View {
  x: number;
  y: number;
  scale: number;
}

const GRID_MM = 100;

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [view, setView] = useState<View>({ x: 40, y: 40, scale: 1 });
  const [cursor, setCursor] = useState<Pt | null>(null);
  const panRef = useRef<{ pointer: Pt; view: View } | null>(null);

  const plan = usePlanEditor((s) => s.plan);
  const floorPlanUrl = usePlanEditor((s) => s.floorPlanUrl);
  const tool = usePlanEditor((s) => s.tool);
  const rightAngle = usePlanEditor((s) => s.rightAngle);
  const thickness = usePlanEditor((s) => s.thickness_mm);
  const selectedWallId = usePlanEditor((s) => s.selectedWallId);
  const selectedOpeningId = usePlanEditor((s) => s.selectedOpeningId);
  const doorWidthMm = usePlanEditor((s) => s.doorWidthMm);
  const pendingMm = usePlanEditor((s) => s.pendingMm);
  const pendingPx = usePlanEditor((s) => s.pendingPx);
  const canvasClick = usePlanEditor((s) => s.canvasClick);
  const selectWall = usePlanEditor((s) => s.selectWall);
  const selectOpening = usePlanEditor((s) => s.selectOpening);

  const image = useImage(floorPlanUrl);
  const pxPerMm = renderPxPerMm(plan);

  // 컨테이너 크기 추적
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: Math.max(200, entry.contentRect.width),
          height: Math.max(200, entry.contentRect.height),
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 이미지가 처음 로드되면 화면에 맞춘다 (이전 렌더 값을 기억하는 패턴, 사용자 줌은 그 뒤로 유지)
  const [fittedFor, setFittedFor] = useState<HTMLImageElement | null>(null);
  if (image && fittedFor !== image) {
    setFittedFor(image);
    const scale =
      Math.min(size.width / image.width, size.height / image.height) * 0.95;
    setView({
      scale,
      x: (size.width - image.width * scale) / 2,
      y: (size.height - image.height * scale) / 2,
    });
  }

  const worldPointer = useCallback((stage: Konva.Stage | null): Pt | null => {
    const p = stage?.getRelativePointerPosition();
    return p ? { x: p.x, y: p.y } : null;
  }, []);

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    setView((v) => zoomAt(pointer, v, e.evt.deltaY < 0 ? 1 : -1));
  };

  const onPointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (e.evt.button === 2) {
      const pointer = stage?.getPointerPosition();
      if (pointer) panRef.current = { pointer, view };
      return;
    }
    if (e.evt.button !== 0) return;
    const world = worldPointer(stage);
    if (world) canvasClick(world);
  };

  const onPointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pan = panRef.current;
    if (pan) {
      const pointer = stage?.getPointerPosition();
      if (pointer)
        setView({
          ...pan.view,
          x: pan.view.x + (pointer.x - pan.pointer.x),
          y: pan.view.y + (pointer.y - pan.pointer.y),
        });
      return;
    }
    setCursor(worldPointer(stage));
  };

  const endPan = () => {
    panRef.current = null;
  };

  const walls = plan?.walls ?? [];
  const openings = plan?.openings ?? [];
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const labelFont = 12 / view.scale;

  // 벽 그리기 미리보기 끝점(mm)
  let previewMm: [number, number] | null = null;
  if (tool === "wall" && pendingMm && cursor && pxPerMm) {
    let point = snapToEndpoints(
      snapToGrid(pointPxToMm(cursor, pxPerMm)),
      walls,
    );
    if (rightAngle) point = snapRightAngle(pendingMm, point);
    previewMm = point;
  }

  // 문 놓기 미리보기
  const previewDoor =
    tool === "door" && cursor && pxPerMm
      ? placeDoor(pointPxToMm(cursor, pxPerMm), walls, openings, doorWidthMm)
      : null;
  const previewDoorWall = previewDoor
    ? wallById.get(previewDoor.wall_id)
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`editor__stage editor__stage--${tool}`}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="plan-canvas"
    >
      <Stage
        width={size.width}
        height={size.height}
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={() => {
          endPan();
          setCursor(null);
        }}
      >
        <Layer listening={false}>
          {image ? (
            <KonvaImage image={image} />
          ) : (
            pxPerMm && <Grid view={view} size={size} pxPerMm={pxPerMm} />
          )}
        </Layer>

        <Layer>
          {pxPerMm &&
            walls.map((wall) => (
              <WallShape
                key={wall.id}
                wall={wall}
                pxPerMm={pxPerMm}
                selected={wall.id === selectedWallId}
                labelFont={labelFont}
                viewScale={view.scale}
                onSelect={
                  tool === "select" ? () => selectWall(wall.id) : undefined
                }
              />
            ))}

          {pxPerMm &&
            openings.map((opening) => {
              const wall = wallById.get(opening.wall_id);
              if (!wall) return null;
              return (
                <OpeningShape
                  key={opening.id}
                  wall={wall}
                  opening={opening}
                  pxPerMm={pxPerMm}
                  selected={opening.id === selectedOpeningId}
                  viewScale={view.scale}
                  onSelect={
                    tool === "select" || tool === "door"
                      ? () => selectOpening(opening.id)
                      : undefined
                  }
                />
              );
            })}

          {pxPerMm && previewDoor && previewDoorWall && (
            <Group opacity={0.5} listening={false}>
              <OpeningShape
                wall={previewDoorWall}
                opening={previewDoor}
                pxPerMm={pxPerMm}
                selected
                viewScale={view.scale}
              />
            </Group>
          )}

          {pxPerMm && pendingMm && previewMm && (
            <Line
              points={[
                mmToPx(pendingMm[0], pxPerMm),
                mmToPx(pendingMm[1], pxPerMm),
                mmToPx(previewMm[0], pxPerMm),
                mmToPx(previewMm[1], pxPerMm),
              ]}
              stroke="#2563eb"
              strokeWidth={mmToPx(thickness, pxPerMm)}
              lineCap="square"
              opacity={0.4}
              listening={false}
            />
          )}
          {pxPerMm && pendingMm && (
            <Circle
              x={mmToPx(pendingMm[0], pxPerMm)}
              y={mmToPx(pendingMm[1], pxPerMm)}
              radius={5 / view.scale}
              fill="#2563eb"
              listening={false}
            />
          )}

          {pendingPx && (
            <>
              <Circle
                x={pendingPx.x}
                y={pendingPx.y}
                radius={5 / view.scale}
                fill="#d97706"
                listening={false}
              />
              {cursor && (
                <Line
                  points={[pendingPx.x, pendingPx.y, cursor.x, cursor.y]}
                  stroke="#d97706"
                  strokeWidth={2 / view.scale}
                  dash={[8 / view.scale, 6 / view.scale]}
                  listening={false}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}

function WallShape({
  wall,
  pxPerMm,
  selected,
  labelFont,
  viewScale,
  onSelect,
}: {
  wall: Wall;
  pxPerMm: number;
  selected: boolean;
  labelFont: number;
  viewScale: number;
  onSelect?: () => void;
}) {
  const ax = mmToPx(wall.a[0], pxPerMm);
  const ay = mmToPx(wall.a[1], pxPerMm);
  const bx = mmToPx(wall.b[0], pxPerMm);
  const by = mmToPx(wall.b[1], pxPerMm);
  const width = mmToPx(wall.thickness_mm, pxPerMm);
  const label = `${wallLength(wall).toLocaleString()} mm`;
  return (
    <>
      <Line
        points={[ax, ay, bx, by]}
        stroke={selected ? "#2563eb" : "#374151"}
        strokeWidth={width}
        lineCap="square"
        opacity={0.85}
        hitStrokeWidth={Math.max(width, 12 / viewScale)}
        onPointerDown={
          onSelect
            ? (e: KonvaEventObject<PointerEvent>) => {
                if (e.evt.button !== 0) return;
                e.cancelBubble = true;
                onSelect();
              }
            : undefined
        }
        listening={Boolean(onSelect)}
      />
      <Text
        x={(ax + bx) / 2}
        y={(ay + by) / 2}
        text={label}
        fontSize={labelFont}
        fill={selected ? "#1d4ed8" : "#111827"}
        offsetX={(label.length * labelFont * 0.55) / 2}
        offsetY={labelFont + width / 2 + 2 / viewScale}
        listening={false}
      />
    </>
  );
}

/**
 * 개구부 1개. 벽 위 구간을 지워(destination-out) 틈을 내고, 여닫이문은 열린 문짝과 열림 부채꼴을 그린다.
 * 부채꼴 꼭짓점은 판정과 같은 doorZone() 에서 온다. 창은 틈 위에 얇은 선.
 */
function OpeningShape({
  wall,
  opening,
  pxPerMm,
  selected,
  viewScale,
  onSelect,
}: {
  wall: Wall;
  opening: Opening;
  pxPerMm: number;
  selected: boolean;
  viewScale: number;
  onSelect?: () => void;
}) {
  const [ax, ay] = wall.a;
  const dx = wall.b[0] - ax;
  const dy = wall.b[1] - ay;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const ux = dx / length;
  const uy = dy / length;
  const p0: [number, number] = [
    mmToPx(ax + ux * opening.offset_mm, pxPerMm),
    mmToPx(ay + uy * opening.offset_mm, pxPerMm),
  ];
  const p1: [number, number] = [
    mmToPx(ax + ux * (opening.offset_mm + opening.width_mm), pxPerMm),
    mmToPx(ay + uy * (opening.offset_mm + opening.width_mm), pxPerMm),
  ];
  const t = mmToPx(wall.thickness_mm, pxPerMm);
  const color = selected ? "#2563eb" : "#4b5563";
  const zone = doorZone(wall, opening);
  const zonePx = zone?.corners.flatMap(([x, y]) => [
    mmToPx(x, pxPerMm),
    mmToPx(y, pxPerMm),
  ]);
  const hinge = zonePx ? [zonePx[0] ?? 0, zonePx[1] ?? 0] : null;
  const leafEnd = zonePx
    ? [zonePx[zonePx.length - 2] ?? 0, zonePx[zonePx.length - 1] ?? 0]
    : null;
  const onPointerDown = onSelect
    ? (e: KonvaEventObject<PointerEvent>) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        onSelect();
      }
    : undefined;

  return (
    <>
      <Line
        points={[...p0, ...p1]}
        stroke="#000"
        strokeWidth={t}
        globalCompositeOperation="destination-out"
        listening={false}
      />
      {opening.type === "window" && (
        <Line
          points={[...p0, ...p1]}
          stroke="#60a5fa"
          strokeWidth={Math.max(t * 0.3, 1 / viewScale)}
          listening={false}
        />
      )}
      {/* 틈 자체를 클릭해 선택할 수 있도록 투명한 선 (선택 시에만 보인다) */}
      <Line
        points={[...p0, ...p1]}
        stroke={color}
        strokeWidth={t}
        opacity={selected ? 0.25 : 0}
        hitStrokeWidth={Math.max(t, 12 / viewScale)}
        onPointerDown={onPointerDown}
        listening={Boolean(onSelect)}
      />
      {zonePx && hinge && leafEnd && (
        <>
          <Line
            points={zonePx}
            closed
            fill={selected ? "rgba(37,99,235,0.14)" : "rgba(75,85,99,0.08)"}
            stroke={color}
            strokeWidth={1 / viewScale}
            dash={[4 / viewScale, 3 / viewScale]}
            onPointerDown={onPointerDown}
            listening={Boolean(onSelect)}
          />
          <Line
            points={[...hinge, ...leafEnd]}
            stroke={color}
            strokeWidth={Math.max(2 / viewScale, t * 0.25)}
            lineCap="round"
            listening={false}
          />
        </>
      )}
    </>
  );
}

/** 도면이 없을 때 100 mm 격자. 보이는 영역만 그린다. */
function Grid({
  view,
  size,
  pxPerMm,
}: {
  view: View;
  size: { width: number; height: number };
  pxPerMm: number;
}) {
  const step = mmToPx(GRID_MM, pxPerMm);
  const left = -view.x / view.scale;
  const top = -view.y / view.scale;
  const right = left + size.width / view.scale;
  const bottom = top + size.height / view.scale;
  return (
    <Shape
      sceneFunc={(ctx, shape) => {
        ctx.beginPath();
        for (let x = Math.floor(left / step) * step; x <= right; x += step) {
          ctx.moveTo(x, top);
          ctx.lineTo(x, bottom);
        }
        for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
          ctx.moveTo(left, y);
          ctx.lineTo(right, y);
        }
        ctx.setAttr("strokeStyle", "#e5e7eb");
        ctx.setAttr("lineWidth", 1 / view.scale);
        ctx.stroke();
        // 원점 표시
        ctx.beginPath();
        ctx.moveTo(-step, 0);
        ctx.lineTo(step, 0);
        ctx.moveTo(0, -step);
        ctx.lineTo(0, step);
        ctx.setAttr("strokeStyle", "#9ca3af");
        ctx.stroke();
        ctx.fillStrokeShape(shape);
      }}
      listening={false}
    />
  );
}
