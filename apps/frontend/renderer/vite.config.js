import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({mode}) => ({
  root: __dirname,              // apps/frontend/renderer
  plugins: [react()],
  base: mode === "production" ? "./" : "/",
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
