// Skip native rebuilds on CI and Linux
const isCI = process.env.CI === 'true';
const isLinux = process.platform === 'linux';
if (isCI || isLinux) {
  console.log('[postinstall] Skipping electron-rebuild (CI or Linux).');
  process.exit(0);
}

// Optional: run rebuild locally on macOS/Windows
import { spawnSync } from 'node:child_process';
console.log('[postinstall] Rebuilding better-sqlite3 for Electron...');
const r = spawnSync('pnpm', ['exec', 'electron-rebuild', '-f', '-w', 'better-sqlite3'], { stdio: 'inherit' });
if (r.status !== 0) {
  console.warn('[postinstall] electron-rebuild failed; retry with "pnpm run rebuild:native".');
  process.exit(0);
}
