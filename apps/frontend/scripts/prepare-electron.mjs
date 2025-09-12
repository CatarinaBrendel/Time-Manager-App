// apps/frontend/scripts/prepare-electron.mjs
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const cwd = process.cwd();
const vendorBin =
  process.platform === "darwin"
    ? join(cwd, "vendor/electron/Electron.app/Contents/MacOS/Electron")
    : process.platform === "linux"
    ? join(cwd, "vendor/electron/electron/electron")
    : join(cwd, "vendor/electron/electron/electron.exe");

function run(cmd) {
  console.log(`[prepare-electron] $ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function detectElectronVersion() {
  try {
    if (existsSync(vendorBin)) {
      const v = execSync(`"${vendorBin}" --version`).toString().trim();
      return v.replace(/^v/, "");
    }
  } catch {}
  try {
    const v = execSync("pnpm exec electron --version", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return v.replace(/^v/, "");
  } catch {}
  return null;
}

function archFlag() {
  const m = process.arch;
  return m === "x64" || m === "ia32" ? "x64" : "arm64";
}

try {
  // Optional: ensure vendored Electron exists if you rely on it
  try {
    run("pnpm run fetch:electron");
  } catch {
    console.log("[prepare-electron] fetch:electron skipped or not needed.");
  }

  const ev = detectElectronVersion();
  if (!ev) {
    console.error(
      "[prepare-electron] Electron not found (vendor or devDep). Install it: pnpm add -D electron"
    );
    process.exit(1);
  }
  console.log(`[prepare-electron] Electron ${ev} detected.`);

  // Remove stale native build artefacts (avoid ABI confusion)
  try {
    rmSync("node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build", {
      recursive: true,
      force: true,
    });
    console.log("[prepare-electron] cleaned old better-sqlite3 build");
  } catch(e) {
    console.log("[prepare-electron] skip clean: could not remove old build", e?.message || e);
  }

  // Rebuild strictly for Electron (the runtime we will launch)
  run(`pnpm dlx @electron/rebuild -v "${ev}" -f -w better-sqlite3 --arch "${archFlag()}"`);
  console.log("[prepare-electron] OK — native modules match Electron ABI.");
} catch (e) {
  console.error("[prepare-electron] Failed.", e?.message || e);
  process.exit(typeof e?.status === "number" ? e.status : 1);
}
