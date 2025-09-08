// Run Electron with proper quoting (spaces-safe) on any OS.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";

const cwd = process.cwd();
const destDir = join(cwd, "vendor", "electron");

function resolveBin() {
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

const bin = resolveBin();
if (!existsSync(bin)) {
  console.error("Electron binary not found. Run `pnpm run fetch:electron` first.");
  process.exit(1);
}

// Pass through any args given to this script (e.g., ".")
const args = process.argv.slice(2);
const child = spawn(bin, args, { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
