// Single JSONL log writer for MAIN process + anything in electron/backend/*
// Renderer logs go through IPC to here.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES = 10;                     // keep 10 rotated files
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const ACTIVE_FILE = path.join(LOG_DIR, 'app.log');

let sessionId = cryptoSafeId();

ensureDir(LOG_DIR);

// ---------- public API ----------

function getLogDir() {
  return LOG_DIR;
}

function getSessionId() {
  return sessionId;
}

/** Generate a per-intent trace id in caller code (renderer or main). */
function newTraceId() {
  return cryptoSafeId();
}

let DEBUG_ENABLED = false;
function setDebugEnabled(enabled) {
  DEBUG_ENABLED = !!enabled;
}

function info(event, message, context = {}, trace_id = null) {
  writeLine(buildLine('INFO', event, message, context, trace_id));
}
function warn(event, message, context = {}, trace_id = null) {
  writeLine(buildLine('WARN', event, message, context, trace_id));
}
function error(event, message, context = {}, trace_id = null) {
  writeLine(buildLine('ERROR', event, message, context, trace_id));
}
function debug(event, message, context = {}, trace_id = null) {
  if (!DEBUG_ENABLED) return;
  writeLine(buildLine('DEBUG', event, message, context, trace_id));
}

// Global crash hooks
process.on('uncaughtException', (err) => {
  writeLine(buildLine('ERROR', 'main_uncaught_exception', err?.message || 'Uncaught exception', {
    stack: safeStack(err),
    name: err?.name
  }));
});
process.on('unhandledRejection', (reason) => {
  writeLine(buildLine('ERROR', 'main_unhandled_rejection', str(reason), {
    stack: safeStack(reason)
  }));
});

// ---------- impl ----------

// BigInt-safe replacer (converts BigInt to number if safe, else to string)
function bigintReplacer(_key, value) {
  if (typeof value === 'bigint') {
    const asNum = Number(value);
    return Number.isSafeInteger(asNum) ? asNum : value.toString();
  }
  return value;
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, bigintReplacer);
  } catch {
    // Last resort — avoid crashing the logger
    try { return String(obj); } catch { return '[unstringifiable]'; }
  }
}

function buildLine(level, event, message, context, trace_id) {
  const pkgVersion = safeAppVersion();
  // sanitize may return BigInts inside objects → safeStringify will handle later
  return sanitize({
    ts: new Date().toISOString(),
    level,
    proc: 'main',
    version: pkgVersion,
    session_id: sessionId,
    trace_id: trace_id || null,
    event,
    message: str(message),
    context: context || {}
  });
}

function writeLine(obj) {
  try {
    rotateIfNeeded();
    fs.appendFileSync(ACTIVE_FILE, safeStringify(obj) + os.EOL, { encoding: 'utf8' });
  } catch (err) {
    // Last resort: write to console
    // eslint-disable-next-line no-console
    console.error('Failed to write log line:', err && err.message);
  }
}

function rotateIfNeeded() {
  try {
    const stat = fs.existsSync(ACTIVE_FILE) ? fs.statSync(ACTIVE_FILE) : null;
    if (!stat || stat.size < MAX_SIZE_BYTES) return;

    // Find next index
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('app.log.'));
    const indices = files.map(f => {
      const n = Number(f.split('.').pop());
      return Number.isFinite(n) ? n : 0;
    });
    const next = (indices.length ? Math.max(...indices) + 1 : 1);

    // Rotate current
    const rotated = path.join(LOG_DIR, `app.log.${next}`); // <-- fixed template string
    fs.renameSync(ACTIVE_FILE, rotated);

    // Trim old files
    trimOldRotations();
  } catch (_) { /* ignore */ }
}

function trimOldRotations() {
  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith('app.log.'))
    .map(f => ({ f, t: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  for (let i = MAX_FILES; i < files.length; i++) {
    try { fs.rmSync(path.join(LOG_DIR, files[i].f)); } catch (_) { /* ignore */ }
  }
}

// Redact obvious PII/tokens, truncate big strings
function sanitize(line) {
  const REDACT = '[redacted]';
  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const tokenLikeRe = /(Bearer\s+[A-Za-z0-9._-]+|[A-Fa-f0-9]{32,})/g;

  function walk(v, depth = 0) {
    if (v == null) return v;
    if (depth > 4) return '[depth-limit]';
    if (typeof v === 'string') {
      let s = v.replace(emailRe, REDACT).replace(tokenLikeRe, REDACT);
      if (s.length > 512) s = s.slice(0, 512) + '…';
      return s;
    }
    if (typeof v === 'bigint') {
      const asNum = Number(v);
      return Number.isSafeInteger(asNum) ? asNum : v.toString();
    }
    if (Array.isArray(v)) return v.map(x => walk(x, depth + 1));
    if (typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k], depth + 1);
      return out;
    }
    return v;
  }
  return walk(line);
}

function safeAppVersion() {
  try { return app.getVersion(); } catch { return '0.0.0-dev'; }
}

function safeStack(err) {
  if (!err) return null;
  const stack = (err && err.stack) ? String(err.stack) : null;
  if (!stack) return null;
  return stack.split('\n').slice(0, 15).join('\n'); // truncate
}

function str(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  // BigInt-safe stringify for message payloads
  const s = safeStringify(x);
  return s === '[object Object]' ? String(x) : s;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cryptoSafeId() {
  try {
    return require('crypto').randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}

module.exports = {
  getLogDir,
  getSessionId,
  newTraceId,
  setDebugEnabled,
  info, warn, error, debug,
};
