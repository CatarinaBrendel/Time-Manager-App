// scripts/rebuild-sqlite.mjs
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let electronVersion = '';
try {
  electronVersion = require('electron/package.json').version;
} catch {
  console.error('[rebuild-sqlite] Electron is not installed in this package. Run: pnpm --filter ./apps/frontend add -D electron');
  process.exit(1);
}

const env = {
  ...process.env,
  npm_config_runtime: 'electron',
  npm_config_target: electronVersion,
  npm_config_disturl: 'https://electronjs.org/headers',
  npm_config_build_from_source: '1'
};

console.log(`[rebuild-sqlite] Rebuilding better-sqlite3 for Electron ${electronVersion}…`);
const result = spawnSync('pnpm', ['rebuild', 'better-sqlite3', '--unsafe-perm'], {
  stdio: 'inherit',
  env
});
process.exit(result.status ?? 0);
