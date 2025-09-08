const { z } = require('zod');

const SessionKind  = z.enum(['focus', 'break']);
const SessionStart = z.object({
  task_id: z.number().int().positive().nullish(),
  kind: SessionKind.default('focus'),
});
const SessionStop   = z.object({ id: z.number().int().positive() });
const SessionPause  = z.object({ id: z.number().int().positive() });   // session id
const SessionResume = z.object({ id: z.number().int().positive() });   // session id

module.exports = { SessionKind, SessionStart, SessionStop, SessionPause, SessionResume };
