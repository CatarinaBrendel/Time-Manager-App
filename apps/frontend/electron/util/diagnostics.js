const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const AdmZip = require('adm-zip');
const logger = require('./logger');

function collectLogFiles(days = 7) {
  const dir = logger.getLogDir();
  if (!fs.existsSync(dir)) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return fs.readdirSync(dir)
    .filter(f => f.startsWith('app.log'))
    .map(f => path.join(dir, f))
    .filter(p => {
      try { return fs.statSync(p).mtimeMs >= cutoff; } catch { return false; }
    });
}

function buildDiagnosticsJson() {
  const pkgVersion = app.getVersion();
  const { totalmem, freemem, platform, release, arch } = os;

  return {
    generated_at: new Date().toISOString(),
    app_version: pkgVersion,
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    os: { platform: platform(), release: release(), arch: arch(), totalmem: totalmem(), freemem: freemem() },
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    last_errors: tailErrors(5),
  };
}

function tailErrors(n = 5) {
  const dir = logger.getLogDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('app.log'))
    .map(f => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  const out = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).reverse();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.level === 'ERROR') {
          out.push({ ts: obj.ts, event: obj.event, message: obj.message, trace_id: obj.trace_id || null });
          if (out.length >= n) return out;
        }
      } catch (_) { /* ignore bad lines */ }
    }
  }
  return out;
}

async function exportDiagnosticsZip(targetPath) {
  const zip = new AdmZip();
  const logs = collectLogFiles(7);
  for (const p of logs) zip.addLocalFile(p);
  const diagnostics = buildDiagnosticsJson();
  zip.addFile('diagnostics.json', Buffer.from(JSON.stringify(diagnostics, null, 2), 'utf8'));
  zip.writeZip(targetPath);
  return { zipPath: targetPath, files: logs.length };
}

module.exports = { exportDiagnosticsZip };
