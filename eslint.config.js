// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/",
    "**/dist/",
    "**/*.tsbuildinfo",
    "apps/server/src/db/generated/",
    "apps/server/prisma/migrations/",
    "apps/client/src/routeTree.gen.ts",
  ]),

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Browser app (React + Vite)
  {
    files: ["apps/client/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // TanStack Router route files export a `Route` object next to their components
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, allowExportNames: ["Route"] },
      ],
    },
  },

  // shadcn/ui components export variant helpers (e.g. buttonVariants) alongside components
  {
    files: ["apps/client/src/components/ui/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  // Node: server, shared package and tool config files
  {
    files: [
      "apps/server/**/*.ts",
      "packages/shared/**/*.ts",
      "*.config.{js,ts}",
      "apps/*/*.config.{js,ts}",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Must stay last: turns off rules that conflict with Prettier
  prettier,
]);
