import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "node_modules/",
    "public/",
    "tmp/",
    "vendor/",
    "storage/",
    "log/",
    "coverage/",
    "db/",
  ]),
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ["app/frontend/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // AGENTS.md: any 금지. 불가피하면 unknown + 좁히기.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["*.config.{js,ts}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]);
