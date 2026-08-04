import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Recorded debt, downgraded to warnings so `eslint --quiet` can be a blocking
  // CI gate today. These are real and should be ratcheted down over time — the
  // warning count is the tracker. Do not silence them entirely.
  //   no-explicit-any            1443  → typing project, not a refactor task
  //   react/no-unescaped-entities  66  → cosmetic, not auto-fixable
  //   react-hooks/set-state-in-effect 53 → concentrated in the monoliths (TD-07/TD-20)
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // ── React Compiler correctness ratchet ───────────────────────────────────────
  // These four rules stay ERRORS for the whole codebase. The files below already
  // violate them and need real restructuring to fix, so they are scoped down to
  // warnings HERE ONLY — a new violation in any other file still fails CI, and a
  // new violation of a *different* rule in these same files still fails CI.
  //
  // This list may only shrink. Do not add a file to it to make a build pass.
  //
  //   connect/page.tsx:638          immutability  assigns window.location.href to navigate
  //   insights/_reports.tsx:918     purity        Date.now() in the render-time filter
  //   launch/page.tsx:357           purity        "minutes ago" computed in render — never ticks
  //   launch/page.tsx:2454,3253     purity        Date.now() used as an id seed
  //   launch/page.tsx:1409,2023     immutability  fetchCatalogs() called above its declaration
  //   launch/page.tsx:5363          immutability  fetchCampaigns() called above its declaration
  //   CustomizeColumnsModal.tsx:221 refs          ref read during render
  //   TimelineTab.tsx:118           purity        Date.now() decides isActive during render
  //   AINamingTab.tsx:701           refs          ref read during render
  //
  // The launch/page.tsx entries are TD-07 (16.5k-line monolith); the rest are
  // isolated and individually fixable. Full inventory: tests/README.md.
  {
    files: [
      "app/(dashboard)/connect/page.tsx",
      "app/(dashboard)/insights/_reports.tsx",
      "app/(dashboard)/launch/page.tsx",
      "components/ads-manager/CustomizeColumnsModal.tsx",
      "components/inspo/tabs/TimelineTab.tsx",
      "components/templates/AINamingTab.tsx",
    ],
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // search/page.tsx:112 — React Compiler bails on the whole component because the
  // hand-written useCallback/useMemo chain cannot be preserved. Fixing it means
  // deleting the manual memoization and letting the compiler do it; that is a
  // behaviour-visible change, so it is recorded rather than done here.
  {
    files: ["app/(dashboard)/search/page.tsx"],
    rules: { "react-hooks/preserve-manual-memoization": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
