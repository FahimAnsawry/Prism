import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must come before react(): generates src/routeTree.gen.ts from src/routes/
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // Resolve workspace packages (e.g. @prism/shared) to their TypeScript source
    conditions: ["source", ...defaultClientConditions],
  },
  optimizeDeps: {
    // Pre-bundling lucide-react/dynamic (one lazy import per icon) alongside lucide-react splits
    // every icon into its own chunk, and the main lucide-react entry then pulls in all ~1,900 of
    // them on every page load. Served unbundled, its icons load only when a board shows one.
    exclude: ["lucide-react/dynamic"],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
});
