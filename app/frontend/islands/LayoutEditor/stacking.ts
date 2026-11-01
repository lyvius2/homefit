// 드래그해서 놓을 때 집기가 올라앉을 높이(설계서 S-06). 순수 함수.
import { obbFromFootprint, satIntersects } from "~/lib/geometry";

interface Stackable {
  key: string;
  x_mm: number;
  y_mm: number;
  z_mm: number;
  rotation_deg: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
}

/**
 * key 집기가 놓일 z_mm: 바닥 풋프린트가 겹치는 다른 집기 중 바닥이 이 집기 바닥보다 높지 않은 것들의 윗면 최대값.
 * 그런 집기가 없으면 바닥(0). 바닥이 더 높은 집기(이미 위에 올라와 있는 모니터 등)는 받침이 아니므로 제외한다.
 */
export function restingZ(items: readonly Stackable[], key: string): number {
  const target = items.find((w) => w.key === key);
  if (!target) return 0;
  const box = obbFromFootprint({
    x: target.x_mm,
    y: target.y_mm,
    width: target.width_mm,
    depth: target.depth_mm,
    rotation_deg: target.rotation_deg,
  });
  let top = 0;
  for (const other of items) {
    if (other.key === key || other.z_mm > target.z_mm) continue;
    const otherBox = obbFromFootprint({
      x: other.x_mm,
      y: other.y_mm,
      width: other.width_mm,
      depth: other.depth_mm,
      rotation_deg: other.rotation_deg,
    });
    if (satIntersects(box, otherBox))
      top = Math.max(top, other.z_mm + other.height_mm);
  }
  return top;
}
