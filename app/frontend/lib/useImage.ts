import { useEffect, useState } from "react";

interface Loaded {
  url: string;
  image: HTMLImageElement;
}

/** URL 의 이미지를 로드해 HTMLImageElement 를 돌려준다 (Konva Image / three 텍스처용). 로드 전·실패·url 없음은 null. */
export function useImage(url: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!url) return;
    const element = new window.Image();
    let cancelled = false;
    element.onload = () => {
      if (!cancelled) setLoaded({ url, image: element });
    };
    element.src = url;
    return () => {
      cancelled = true;
      element.onload = null;
    };
  }, [url]);

  return loaded && loaded.url === url ? loaded.image : null;
}
