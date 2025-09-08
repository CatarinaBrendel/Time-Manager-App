import { build } from "esbuild";

const watch = process.argv.includes("--watch");

await build({
  entryPoints: ["renderer/src/main.jsx"],
  bundle: true,
  outfile: "renderer/bundle.js",
  platform: "browser",
  format: "esm",
  jsx: "automatic",          // React 17+ JSX transform
  sourcemap: true,
  logLevel: "info",
  watch: watch && {
    onRebuild(error) {
      if (error) console.error("Rebuild failed:", error);
      else console.log("Rebuilt");
    }
  }
});

console.log("Initial build complete");
