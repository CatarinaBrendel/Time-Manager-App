// apps/frontend/scripts/rebuild-native.mjs
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function detectElectronVersion() {
  // Prefer vendored Electron (your fetch script puts it here)
  const vendored = join(process.cwd(), 'vendor/electron/Electron.app/Contents/MacOS/Electron')
  if (existsSync(vendored)) {
    try {
      const out = execSync(`"${vendored}" --version`, { encoding: 'utf8' }).trim()
      return out.replace(/^v/, '')
    } catch { /* ignore */ }
  }
  // Fallback: devDependency "electron"
  try {
    return require('electron/package.json').version
  } catch { /* ignore */ }
  return null
}

const ev = detectElectronVersion()
if (!ev) {
  console.error('[rebuild:native] Electron not found. Fetch or install Electron first.')
  process.exit(1)
}

const arch = process.arch === 'x64' ? 'x64' : 'arm64'
const args = ['-f', '-w', 'better-sqlite3', '-v', ev, '--arch', arch]

function tryExec(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

// Prefer the local binary if installed
if (!tryExec(`pnpm exec electron-rebuild ${args.join(' ')}`)) {
  // Fallback to dlx (no local install needed)
  if (!tryExec(`pnpm dlx @electron/rebuild electron-rebuild ${args.join(' ')}`)) {
    console.error('[rebuild:native] electron-rebuild failed.')
    process.exit(1)
  }
}
