// apps/frontend/scripts/postinstall.mjs
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

// allow `require(...)` inside an .mjs file
const require = createRequire(import.meta.url)

const SKIP = process.env.SKIP_ELECTRON_REBUILD === '1'
if (SKIP) {
  console.log('[postinstall] SKIP_ELECTRON_REBUILD=1 -> skipping electron-rebuild')
  process.exit(0)
}

function detectElectronVersion() {
  // 1) vendored Electron
  const vendored = join(process.cwd(), 'vendor/electron/Electron.app/Contents/MacOS/Electron')
  if (existsSync(vendored)) {
    try {
      const v = execSync(`"${vendored}" --version`, { encoding: 'utf8' }).trim()
      return v.replace(/^v/, '')
    } catch { /* ignore */ }
  }
  // 2) devDependency electron
  try {
    return require('electron/package.json').version
  } catch { /* ignore */ }

  return null
}

const ev = detectElectronVersion()
if (!ev) {
  console.log('[postinstall] Electron not found yet; skipping rebuild. (Run `pnpm run rebuild:native` later.)')
  process.exit(0)
}

const arch = process.arch === 'x64' ? 'x64' : 'arm64'
try {
  console.log(`[postinstall] Rebuilding native modules for Electron ${ev} (${arch})...`)
  execSync(`pnpm dlx @electron/rebuild -v "${ev}" -f -w better-sqlite3 --arch "${arch}"`, { stdio: 'inherit' })
  console.log('[postinstall] electron-rebuild completed.')
} catch {
  console.warn('[postinstall] electron-rebuild failed; you can retry with: pnpm run rebuild:native')
  // do NOT fail install:
  process.exit(0)
}
