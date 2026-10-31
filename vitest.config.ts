import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// TS 단위 테스트(기하·유틸·에디터 로직). 브라우저 DOM 이 필요한 테스트는 파일 상단에
// `// @vitest-environment jsdom` 을 붙인다 (jsdom 은 필요해질 때 추가).
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app/frontend", import.meta.url)),
    },
  },
  test: {
    include: ["app/frontend/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
