// Lightweight wrapper so React code can call log.info/warn/error/debug.
// Adds proc: 'renderer', version, and a per-launch session_id.

let sessionId = makeId();
const version = (window.env && window.env.appVersion) || '0.0.0-dev';

function base(event, message, level = 'INFO', context = {}, trace_id = null) {
  const line = {
    level,
    event,
    message,
    context: context || {},
    version,
    session_id: sessionId,
    trace_id
  };
  if (window?.logging?.write) {
    return window.logging.write(line);
  } else {
    console.log(`[${level}] ${event}:`, message, context);
    return Promise.resolve({ ok: true, dev: true });
  }
}

export function info(event, message, context, traceId)  { return base(event, message, 'INFO',  context, traceId); }
export function warn(event, message, context, traceId)  { return base(event, message, 'WARN',  context, traceId); }
export function error(event, message, context, traceId) { return base(event, message, 'ERROR', context, traceId); }
export function debug(event, message, context, traceId) { return base(event, message, 'DEBUG', context, traceId); }

export async function exportDiagnostics() {
  return window?.logging?.exportDiagnostics?.();
}
export async function getLogDir() {
  return window?.logging?.getLogDir?.();
}
export function newTraceId() { return makeId(); }

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// Global capture
export function attachGlobalErrorHandlers() {
  window.addEventListener('error', (e) => {
    error('renderer_unhandled_error', e?.message || 'window.error', { filename: e?.filename, lineno: e?.lineno, colno: e?.colno, stack: e?.error?.stack?.split('\n')?.slice(0, 15)?.join('\n') });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason;
    error('renderer_unhandled_rejection', String(reason?.message || reason || 'unhandledrejection'), { stack: reason?.stack?.split('\n')?.slice(0, 15)?.join('\n') });
  });
}
