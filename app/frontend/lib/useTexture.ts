import { useEffect, useState } from "react";
import { SRGBColorSpace, Texture, TextureLoader } from "three";

// URL 별 텍스처 캐시. 같은 이미지를 쓰는 집기가 여러 개여도 한 번만 받는다 (AGENTS.md: 지오메트리·텍스처 재사용).
const cache = new Map<string, Texture>();
const pending = new Map<string, Promise<Texture>>();
const loader = new TextureLoader();

function loadTexture(url: string): Promise<Texture> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(url);
  if (inflight) return inflight;
  const promise = loader.loadAsync(url).then((texture) => {
    texture.colorSpace = SRGBColorSpace;
    cache.set(url, texture);
    pending.delete(url);
    return texture;
  });
  pending.set(url, promise);
  return promise;
}

/** 로드 전·실패·url 없음은 null. Suspense 를 쓰지 않는다. */
export function useTexture(url: string | null): Texture | null {
  const [loaded, setLoaded] = useState<{
    url: string;
    texture: Texture;
  } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadTexture(url)
      .then((texture) => {
        if (!cancelled) setLoaded({ url, texture });
      })
      .catch(() => {
        /* 텍스처 없이 색 박스로 그린다 */
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;
  return loaded?.url === url ? loaded.texture : (cache.get(url) ?? null);
}
