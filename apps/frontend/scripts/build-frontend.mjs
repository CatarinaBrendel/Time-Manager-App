// apps/frontend/scripts/build-frontend.mjs
import esbuild from 'esbuild';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isWatch = process.argv.includes('--watch');
const root = resolve(fileURLToPath(import.meta.url), '..', '..'); // apps/frontend

// Candidate entries in priority order
const candidates = [
  'src/main.jsx',
  'renderer/src/main.jsx',
  'src/main.js',
  'renderer/src/main.js',
];

const entry = candidates
  .map(p => resolve(root, p))
  .find(p => existsSync(p));

if (!entry) {
  console.error(
    `[build] Could not find an entry. Tried:\n  - ${candidates.join('\n  - ')}\n` +
    `Run from apps/frontend and ensure one of those files exists.`
  );
  process.exit(1);
}

const outFile = resolve(root, 'renderer', 'bundle.js');

const options = {
  entryPoints: [entry],
  outfile: outFile,
  bundle: true,
  sourcemap: true,
  platform: 'browser',
  target: 'es2020',
  loader: { '.jsx': 'jsx' },
  jsx: 'automatic',
};

if (isWatch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(`[esbuild] watching ${entry} → ${outFile}`);
} else {
  await esbuild.build(options);
  console.log(`[esbuild] built ${entry} → ${outFile}`);
}
