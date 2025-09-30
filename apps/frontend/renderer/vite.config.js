import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  root: __dirname,
  plugins: [react()],
  base: mode === "production" ? "./" : "/",
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        mini: path.resolve(__dirname, "src/widget/widget.html"),
      },
    },
  },
}));
