// Download Electron app into vendor/electron for macOS (tries arm64, then x64)
import { mkdirSync, existsSync, createWriteStream } from "fs";
import { join } from "path";
import { get } from "https";
import { spawnSync } from "child_process";

const VER = "38.0.0";
const destDir = join(process.cwd(), "vendor/electron");
const bin = join(destDir, "Electron.app/Contents/MacOS/Electron");

if (existsSync(bin)) {
  console.log("Electron already present:", bin);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

function dl(url) {
  return new Promise((resolve, reject) => {
    console.log("Downloading", url);
    const out = createWriteStream("electron.zip");
    get(url, res => {
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      res.pipe(out); out.on("finish", () => out.close(resolve));
    }).on("error", reject);
  });
}

async function main() {
  const archs = ["arm64", "x64"];
  let ok = false;
  for (const a of archs) {
    const url = `https://github.com/electron/electron/releases/download/v${VER}/electron-v${VER}-darwin-${a}.zip`;
    try { await dl(url); ok = true; break; } catch { /* try next */ }
  }
  if (!ok) throw new Error("Failed to download Electron zip for arm64/x64");

  const unzip = spawnSync("unzip", ["-q", "electron.zip", "-d", destDir], { stdio: "inherit" });
  if (unzip.status !== 0) throw new Error("unzip failed");
  spawnSync("rm", ["-f", "electron.zip"]);
  // clear macOS quarantine (best-effort)
  spawnSync("xattr", ["-dr", "com.apple.quarantine", join(destDir, "Electron.app")], { stdio: "ignore" });
  console.log("Electron ready:", bin);
}
main().catch(e => { console.error(e); process.exit(1); });
