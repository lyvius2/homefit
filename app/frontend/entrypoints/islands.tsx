// React 섬(island) 진입점.
// <div data-island="PlanEditor" data-props='{"house_id":1}'></div> 같은 요소를 찾아
// 등록된 컴포넌트를 마운트하고, Turbo 페이지 전환 시 언마운트한다.
import type { ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";

type IslandProps = Record<string, unknown>;
type IslandLoader = () => Promise<{ default: ComponentType<IslandProps> }>;

// 컴포넌트는 지연 로드한다. 에디터 번들을 관리 화면에서 내려받지 않기 위함.
const registry: Record<string, IslandLoader> = {
  // PlanEditor: () => import("~/islands/PlanEditor"),     // M4
  // LayoutEditor: () => import("~/islands/LayoutEditor"), // M5
};

const roots = new Map<Element, Root>();

function parseProps(raw: string | undefined): IslandProps {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as IslandProps;
  }
  throw new Error("data-props must be a JSON object");
}

async function mount(element: HTMLElement): Promise<void> {
  if (roots.has(element)) return;
  const name = element.dataset.island ?? "";
  const load = registry[name];
  if (!load) {
    console.error(`[islands] unknown island: "${name}"`);
    return;
  }
  const props = parseProps(element.dataset.props);
  const root = createRoot(element);
  roots.set(element, root);
  const { default: Component } = await load();
  // 로딩 중 페이지가 전환되어 이미 언마운트됐으면 렌더하지 않는다.
  if (!roots.has(element)) return;
  root.render(<Component {...props} />);
}

function mountAll(): void {
  document.querySelectorAll<HTMLElement>("[data-island]").forEach((element) => {
    void mount(element);
  });
}

function unmountAll(): void {
  roots.forEach((root) => root.unmount());
  roots.clear();
}

document.addEventListener("turbo:load", mountAll);
document.addEventListener("turbo:before-render", unmountAll);
document.addEventListener("turbo:before-cache", unmountAll);
