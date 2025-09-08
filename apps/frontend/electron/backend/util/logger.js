function log(...a) { console.log('[TM]', ...a); }
function error(...a) { console.error('[TM]', ...a); }
module.exports = { log, error };