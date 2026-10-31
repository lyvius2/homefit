import { useSyncExternalStore } from "react";

function noop(): void {
  /* 서버 렌더링 등 window 가 없을 때의 구독 해제 */
}

/** CSS 미디어 쿼리 매치 여부. 에디터는 데스크톱(≥ 1024 px) 우선이고 모바일은 보기 전용 (설계서 Section 5). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return noop;
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () =>
      typeof window === "undefined" ? false : window.matchMedia(query).matches,
    () => false,
  );
}

export const MOBILE_QUERY = "(max-width: 1023px)";
