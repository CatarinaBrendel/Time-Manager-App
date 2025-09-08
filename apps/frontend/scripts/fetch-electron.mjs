// Fetch Electron into vendor/electron/ for the current OS/arch.
//
// macOS:   Electron.app/... placed directly under vendor/electron/
// Linux:   unzip creates vendor/electron/electron/ with binary "electron"
// Windows: unzip creates vendor/electron/electron/ with "electron.exe"
//
// Start scripts can keep using macOS path; other OSes will log the binary path.

import { mkdirSync, existsSync, createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { get } from "node:https";
import { spawnSync } from "node:child_process";
import os from "node:os";

const VER = "38.0.0";
const cwd = process.cwd(); // expect to run from apps/frontend
const destDir = join(cwd, "vendor", "electron");
mkdirSync(destDir, { recursive: true });

// Resolve expected binary path depending on platform
const platform = process.platform; // 'darwin' | 'linux' | 'win32'
const arch = process.arch;         // 'arm64' | 'x64' | ...
const zipPath = join(destDir, "electron.zip");

function expectedBinPath() {
  if (platform === "darwin") {
    return join(destDir, "Electron.app", "Contents", "MacOS", "Electron");
  }
  if (platform === "linux") {
    // Electron zip expands into vendor/electron/electron/...
    return join(destDir, "electron", "electron");
  }
  if (platform === "win32") {
    return join(destDir, "electron", "electron.exe");
  }
  // Fallback (unknown platform): assume Linux-like
  return join(destDir, "electron", "electron");
}

const bin = expectedBinPath();
if (existsSync(bin)) {
  console.log("Electron already present:", bin);
  process.exit(0);
}

// ---- helpers ---------------------------------------------------------------

function download(url, outFile) {
  return new Promise((resolve, reject) => {
    console.log("Downloading", url);
    const out = createWriteStream(outFile);
    get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        const redirect = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        res.destroy();
        return download(redirect, outFile).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} on ${url}`));
      }
      res.pipe(out);
      out.on("finish", () => out.close(resolve));
    }).on("error", reject);
  });
}

function have(cmd) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" });
  return r.status === 0;
}

function unzip(zip, dest) {
  // macOS/Linux: prefer `unzip`
  if (platform !== "win32" && have("unzip")) {
    const r = spawnSync("unzip", ["-q", zip, "-d", dest], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("unzip failed");
    return;
  }
  // Windows: PowerShell Expand-Archive
  if (platform === "win32") {
    const ps = "powershell";
    if (!have(ps)) throw new Error("PowerShell not found to extract Electron zip");
    const r = spawnSync(ps, ["-NoProfile", "-Command", `Expand-Archive -Path "${zip}" -DestinationPath "${dest}" -Force`], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("Expand-Archive failed");
    return;
  }
  throw new Error("No supported unzip tool found (install 'unzip' or use Windows PowerShell).");
}

function rmFile(file) {
  spawnSync(process.platform === "win32" ? "del" : "rm", [process.platform === "win32" ? "/f" : "-f", file], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

function clearQuarantine(appPath) {
  if (platform !== "darwin") return;
  if (!have("xattr")) return;
  try {
    spawnSync("xattr", ["-dr", "com.apple.quarantine", appPath], { stdio: "ignore" });
  } catch { /* ignore */ }
}

// ---- build URL(s) ----------------------------------------------------------

// Map Node's arch to Electron asset arch
function archCandidates() {
  if (platform === "darwin") {
    // Prefer Apple Silicon if available, then x64
    return arch === "arm64" ? ["arm64", "x64"] : ["x64", "arm64"];
  }
  if (platform === "linux" || platform === "win32") {
    return arch === "arm64" ? ["arm64", "x64"] : ["x64", "arm64"];
  }
  return ["x64"];
}

function assetPlatform() {
  if (platform === "darwin") return "darwin";
  if (platform === "linux") return "linux";
  if (platform === "win32") return "win32";
  throw new Error(`Unsupported platform: ${platform}`);
}

function assetUrl(p, a) {
  return `https://github.com/electron/electron/releases/download/v${VER}/electron-v${VER}-${p}-${a}.zip`;
}

// ---- main ------------------------------------------------------------------

async function main() {
  // Make sure dest dir exists
  mkdirSync(destDir, { recursive: true });

  const p = assetPlatform();
  const tries = archCandidates().map((a) => ({ p, a, url: assetUrl(p, a) }));

  let ok = false, used = null;
  for (const t of tries) {
    try {
      await download(t.url, zipPath);
      used = t;
      ok = true;
      break;
    } catch (e) {
      // Try next candidate
    }
  }
  if (!ok) {
    throw new Error(`Failed to download Electron zip for ${p} (${archCandidates().join(", ")})`);
  }

  unzip(zipPath, destDir);
  rmFile(zipPath);

  // macOS: app lives at vendor/electron/Electron.app
  // Linux/Windows: zip expands into vendor/electron/electron/...
  if (platform === "darwin") {
    clearQuarantine(join(destDir, "Electron.app"));
  }

  if (!existsSync(bin)) {
    // Try to hint at what exists to help debugging
    const hint = platform === "darwin"
      ? "expected Electron.app in vendor/electron/"
      : "expected 'electron' folder under vendor/electron/";
    throw new Error(`Electron binary not found at ${bin} (${hint})`);
  }

  console.log(`Electron ready: ${bin}`);
  if (platform !== "darwin") {
    console.log(`(On ${platform}, your binary is: ${bin})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
