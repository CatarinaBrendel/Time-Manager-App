// Skip electron-rebuild on CI and on Linux; only run locally on macOS/Windows if desired.
// We keep a manual script `pnpm run rebuild:native` for when you need it.

const isCI = process.env.CI === 'true';
const isLinux = process.platform === 'linux';

if (isCI || isLinux) {
  console.log('[postinstall] Skipping electron-rebuild (CI or Linux).');
  process.exit(0);
}

// Optional: auto-rebuild on developer machines (macOS/Windows)
// Comment out if you prefer manual control.
import { spawnSync } from 'node:child_process';
console.log('[postinstall] Running electron-rebuild for better-sqlite3...');
const r = spawnSync('pnpm', ['exec', 'electron-rebuild', '-f', '-w', 'better-sqlite3'], { stdio: 'inherit' });
if (r.status !== 0) {
  console.warn('[postinstall] electron-rebuild failed; you can retry with "pnpm run rebuild:native".');
  process.exit(0); // don’t block installs
}
