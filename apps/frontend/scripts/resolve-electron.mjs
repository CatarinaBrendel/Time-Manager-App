// scripts/resolve-electron.mjs
import { join } from "node:path";
import { existsSync } from "node:fs";
import os from "node:os";

const cwd = process.cwd();
const destDir = join(cwd, "vendor", "electron");

function binPath() {
  switch (process.platform) {
    case "darwin":
      return join(destDir, "Electron.app", "Contents", "MacOS", "Electron");
    case "linux":
      return join(destDir, "electron", "electron");
    case "win32":
      return join(destDir, "electron", "electron.exe");
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

const bin = binPath();

if (!existsSync(bin)) {
  console.error("Electron binary not found. Run `pnpm run fetch:electron` first.");
  process.exit(1);
}

console.log(bin);
