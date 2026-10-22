import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // NEXT_DIST_DIR로 따로 정한 빌드 폴더(예: 호스팅 모드 시험용 서버)
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent skills are vendored copies managed by skills-lock.json, and
    // .claude/worktrees holds duplicate checkouts of this app.
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
