// electron/backend/repos/reportsRepo.js

const DEFAULT_PAGE_SIZE = 10;

/* ------------------------------ Sorting ------------------------------ */
const SORT_MAP = {
  title: 'title',
  status: 'status',
  due_at: 'due_at',
  project: 'project',
  effective_sec: 'effective_sec',
  updated_at: 'updated_at',
  priority: 'priority_weight'
};
const mapSort = (k) => SORT_MAP[k] || 'updated_at';
const DIR = (d) => (String(d).toUpperCase() === 'DESC' ? 'DESC' : 'ASC');

/* ------------------------------ Defaults (can be read from app_settings later) ------------------------------ */
const DEFAULTS = {
  timezone:     'Europe/Berlin',
  idleMode:     'fixed',   // 'auto' | 'fixed' | 'clocked'
  workStart:    '08:00',   // local HH:MM
  workEnd:      '17:00',   // local HH:MM
  idleGraceMin: 0
};

/* ------------------------------ Time utils ------------------------------ */
const EPOCH = (col) => `CAST(strftime('%s', ${col}) AS INTEGER)`;

/** YYYY-MM-DD for a given IANA tz (e.g., Europe/Berlin) */
function getLocalDateYmd(date = new Date(), tz = 'Europe/Berlin') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Local window [startLocal, endLocal) for day|week|month|year in the given tz. */
function getLocalWindow(period, now = new Date(), tz = 'Europe/Berlin') {
  const p = String(period || '').toLowerCase();

  // Extract local Y/M/D in the target tz (independent of host tz)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).reduce((a, x) => (a[x.type] = x.value, a), {});
  const Y = Number(parts.year), M = Number(parts.month), D = Number(parts.day);

  // helpers
  const ymd = (y, m, d) => `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const at  = (dateStr, hh=0, mm=0, ss=0) =>
    `${dateStr} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  const addDays = (y,m,d, n) => {
    const dt = new Date(Date.UTC(y, m-1, d + n));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth()+1, d: dt.getUTCDate() };
  };

  if (p === 'day') {
    const s = ymd(Y,M,D), e = addDays(Y,M,D,1);
    return { startLocal: at(s,0,0,0), endLocal: at(ymd(e.y,e.m,e.d),0,0,0) };
  }

  if (p === 'week') {
    // Monday-start week
    const dow = new Date(Date.UTC(Y, M-1, D)).getUTCDay(); // Sun=0..Sat=6
    const monDelta = ((dow + 6) % 7);                      // Mon=0
    const start = addDays(Y,M,D, -monDelta);
    const end   = addDays(start.y, start.m, start.d, 7);
    return {
      startLocal: at(ymd(start.y,start.m,start.d),0,0,0),
      endLocal:   at(ymd(end.y,end.m,end.d),0,0,0)
    };
  }

  if (p === 'month') {
    const start = { y: Y, m: M, d: 1 };
    const next  = (M === 12) ? { y: Y+1, m: 1, d: 1 } : { y: Y, m: M+1, d: 1 };
    return {
      startLocal: at(ymd(start.y,start.m,start.d),0,0,0),
      endLocal:   at(ymd(next.y,next.m,next.d),0,0,0)
    };
  }

  if (p === 'year') {
    const start = { y: Y, m: 1, d: 1 };
    const end   = { y: Y+1, m: 1, d: 1 };
    return {
      startLocal: at(ymd(start.y,start.m,start.d),0,0,0),
      endLocal:   at(ymd(end.y,end.m,end.d),0,0,0)
    };
  }

  return null;
}

/* ------------------------------ SQL (list & totals) ------------------------------ */
const LIST_SQL = `
  SELECT
    task_id AS id,
    title,
    status,
    due_at,
    project,
    effective_sec,
    paused_sec,
    priority,
    priority_weight
  FROM v_task_overview
  %WHERE%
  ORDER BY %ORDER%
  LIMIT @limit OFFSET @offset
`;

const COUNT_SQL = `SELECT COUNT(1) AS n FROM v_task_overview %WHERE%`;

const TOTALS_SQL = `
  SELECT
    COALESCE(SUM(effective_sec),0) AS total_worked_sec,
    COALESCE(SUM(paused_sec),0)    AS total_paused_sec
  FROM v_task_overview
  %WHERE%
`;

/** Generic idle/active for any local window via v_activity_events (+1/-1). */
const IDLE_IN_WINDOW_SQL = `
WITH
win AS (
  SELECT
    @start_local AS start_local,
    @end_local   AS end_local,
    datetime(@start_local,'localtime','utc') AS start_utc,
    datetime(@end_local,  'localtime','utc') AS end_utc
),
base AS (
  SELECT ts, delta
  FROM v_activity_events e
  JOIN win w ON ts BETWEEN w.start_utc AND w.end_utc
  UNION ALL SELECT start_utc, 0 FROM win
  UNION ALL SELECT datetime((SELECT end_utc FROM win), '+1 millisecond'), 0
),
ordered AS (
  SELECT
    ts,
    delta,
    LEAD(ts) OVER (ORDER BY ts) AS next_ts,
    SUM(delta) OVER (ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS active_after
  FROM base
)
SELECT
  CAST(ROUND(SUM(CASE WHEN active_after = 0 THEN (julianday(next_ts) - julianday(ts)) * 86400.0 ELSE 0 END)) AS INTEGER) AS total_idle_sec,
  CAST(ROUND(SUM(CASE WHEN active_after > 0 THEN (julianday(next_ts) - julianday(ts)) * 86400.0 ELSE 0 END)) AS INTEGER) AS total_active_sec
FROM ordered
WHERE next_ts IS NOT NULL AND next_ts > ts;
`;

/** Smart daily window (LOCAL start/end) using mode + work hours + optional clock_events */
const DAILY_WINDOW_SMART_SQL = `
WITH
cfg AS (
  SELECT @mode AS mode, @ws AS ws, @we AS we, date(@today_local) AS d
),
sched AS (
  SELECT d || ' ' || ws AS start_local, d || ' ' || we AS end_local FROM cfg
),
sched_utc AS (
  SELECT datetime(start_local,'localtime','utc') AS start_utc,
         datetime(end_local,  'localtime','utc') AS end_utc
  FROM sched
),
clk AS (
  SELECT
    (SELECT MIN(at) FROM clock_events WHERE at BETWEEN datetime((SELECT start_utc FROM sched_utc),'-12 hours') AND datetime((SELECT end_utc FROM sched_utc),'+12 hours') AND kind='in')  AS in_utc,
    (SELECT MAX(at) FROM clock_events WHERE at BETWEEN datetime((SELECT start_utc FROM sched_utc),'-12 hours') AND datetime((SELECT end_utc FROM sched_utc),'+12 hours') AND kind='out') AS out_utc
),
act AS (
  SELECT
    (SELECT MIN(ts) FROM v_activity_events e WHERE ts BETWEEN (SELECT start_utc FROM sched_utc) AND (SELECT end_utc FROM sched_utc)) AS first_utc,
    (SELECT MAX(ts) FROM v_activity_events e WHERE ts BETWEEN (SELECT start_utc FROM sched_utc) AND (SELECT end_utc FROM sched_utc)) AS last_utc
),
now_cap AS (
  SELECT MIN(strftime('%Y-%m-%dT%H:%M:%fZ','now'), (SELECT end_utc FROM sched_utc)) AS now_utc
),
win AS (
  SELECT
    CASE
      WHEN mode='clocked' AND (SELECT in_utc FROM clk) IS NOT NULL
        THEN datetime((SELECT in_utc FROM clk),'utc','localtime')
      WHEN mode='auto'
        THEN CASE WHEN (SELECT first_utc FROM act) IS NULL THEN NULL
                  ELSE datetime((SELECT first_utc FROM act),'utc','localtime') END
      ELSE /* fixed */
        (SELECT start_local FROM sched)
    END AS start_local,

    CASE
      WHEN mode='clocked' AND (SELECT in_utc FROM clk) IS NOT NULL
        THEN
          CASE
            WHEN (SELECT out_utc FROM clk) IS NOT NULL THEN datetime(MIN((SELECT out_utc FROM clk), (SELECT end_utc FROM sched_utc)),'utc','localtime')
            ELSE datetime((SELECT now_utc FROM now_cap),'utc','localtime')
          END
      WHEN mode='auto'
        THEN CASE WHEN (SELECT first_utc FROM act) IS NULL THEN NULL
                  ELSE datetime(MIN(COALESCE((SELECT last_utc FROM act),(SELECT now_utc FROM now_cap)), (SELECT end_utc FROM sched_utc)),'utc','localtime') END
      ELSE /* fixed: end at last activity (or now if open), but never after sched end */
        CASE
          WHEN (SELECT last_utc FROM act) IS NULL THEN NULL
          ELSE datetime(MIN(COALESCE((SELECT last_utc FROM act),(SELECT now_utc FROM now_cap)), (SELECT end_utc FROM sched_utc)),'utc','localtime')
        END
    END AS end_local
)
SELECT start_local, end_local FROM win;
`;

/* ------------------------------ Repo ------------------------------ */
function ReportsRepo(db) {
  const baseWhere = (f = {}) => {
    const clauses = [];
    const params = {};

    // Note: v_task_overview already excludes archived tasks via the view definition.
    if (f.title)      { clauses.push('LOWER(title) LIKE LOWER(@title)'); params.title = `%${f.title}%`; }
    if (f.status)     { clauses.push('status = @status'); params.status = f.status; }
    if (f.projectId)  { clauses.push('project_id = @projectId'); params.projectId = f.projectId; }
    if (f.noProject)  { clauses.push('project_id IS NULL'); }

    if (f.tag) {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM task_tags tt
          JOIN tags tg ON tg.id = tt.tag_id
          WHERE tt.task_id = task_id
            AND tg.name = @tag COLLATE NOCASE
        )
      `);
      params.tag = String(f.tag).trim();
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return { where, params };
  };

  return {
    list(opts = {}) {
      const page = Math.max(1, Number(opts.page || 1));
      const pageSize = Math.max(1, Math.min(Number(opts.pageSize || DEFAULT_PAGE_SIZE), 100));

      const { where, params } = baseWhere({
        title:     opts.filters?.title,
        status:    opts.filters?.status,
        projectId: opts.filters?.projectId,
        noProject: opts.filters?.noProject,
        tag:       opts.filters?.tag,
      });

      const uiPeriod = String(opts.period || '').toLowerCase(); // 'day'|'week'|'month'|'year'|'all'
      const order = `${mapSort(opts.sort)} ${DIR(opts.dir)}`;

      // Optional time window for list (created_at OR due_at) in EPOCH seconds
      const makeDateWindow = (period) => {
        if (!period || period === "all") return null;
        const now = new Date();
        let start, end;
        if (period === 'day') {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
          end   = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0);
        } else if (period === 'week') {
          const tmp = new Date(now);
          const d = (tmp.getDay() + 6) % 7; // Mon=0
          tmp.setDate(tmp.getDate() - d);
          start = new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate(), 0,0,0,0);
          end   = new Date(start); end.setDate(start.getDate()+7);
        } else if (period === 'month') {
          start = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
          end   = new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0);
        } else if (period === 'year') {
          start = new Date(now.getFullYear(), 0, 1, 0,0,0,0);
          end   = new Date(now.getFullYear()+1, 0, 1, 0,0,0,0);
        } else {
          return null;
        }
        return { start_s: Math.floor(start.getTime()/1000), end_s: Math.floor(end.getTime()/1000) };
      };

      const win = makeDateWindow(uiPeriod);

      let whereFinal = where;
      let paramsFinal = { ...params };
      if (win) {
        const whereWin = `
          (
            (
              (@start_s IS NULL OR ${EPOCH('created_at')} >= @start_s) AND
              (@end_s   IS NULL OR ${EPOCH('created_at')} <  @end_s)
            )
            OR
            (
              (@start_s IS NULL OR ${EPOCH('due_at')}     >= @start_s) AND
              (@end_s   IS NULL OR ${EPOCH('due_at')}     <  @end_s)
            )
          )
        `;
        whereFinal = whereFinal ? `${whereFinal} AND ${whereWin}` : `WHERE ${whereWin}`;
        paramsFinal = { ...paramsFinal, start_s: win.start_s, end_s: win.end_s };
      }

      // Rows (paged)
      const rows = db.prepare(
        LIST_SQL.replace('%WHERE%', whereFinal).replace('%ORDER%', order)
      ).all({ ...paramsFinal, limit: pageSize, offset: (page - 1) * pageSize });

      // Count
      const totalCount = db.prepare(COUNT_SQL.replace('%WHERE%', whereFinal)).get(paramsFinal).n;

      // Rollups from the view (list-scope)
      const totals = db.prepare(TOTALS_SQL.replace('%WHERE%', whereFinal)).get(paramsFinal);

      /* ---------------- Idle / Active metrics ---------------- */
      if (['day','week','month','year'].includes(uiPeriod)) {
        if (uiPeriod === 'day') {
          const tz          = DEFAULTS.timezone;
          const idleMode    = (opts.idleMode || DEFAULTS.idleMode).toLowerCase(); // 'auto' | 'fixed' | 'clocked'
          const workStart   = opts.workStart    || DEFAULTS.workStart;
          const workEnd     = opts.workEnd      || DEFAULTS.workEnd;
          const graceMin    = Math.max(0, Number(opts.idleGraceMin ?? DEFAULTS.idleGraceMin));
          const todayLocal  = getLocalDateYmd(new Date(), tz);

          let w;
          try {
            w = db.prepare(DAILY_WINDOW_SMART_SQL).get({
              mode: idleMode, ws: workStart, we: workEnd, today_local: todayLocal
            }) || {};
          } catch (e) {
            // If the dev DB is mid-migration and views don't exist yet
            w = {};
          }

          if (!w.start_local || !w.end_local) {
            totals.total_idle_sec   = 0;
            totals.total_active_sec = 0;
          } else {
            let idle = {};
            try {
              idle = db.prepare(IDLE_IN_WINDOW_SQL).get({
                start_local: w.start_local,
                end_local:   w.end_local
              }) || {};
            } catch (e) {
              idle = { total_idle_sec: 0, total_active_sec: 0 };
            }
            const rawIdle   = Number(idle.total_idle_sec   || 0);
            const rawActive = Number(idle.total_active_sec || 0);

            totals.total_idle_sec   = Math.max(0, rawIdle - graceMin * 60);
            totals.total_active_sec = rawActive;
          }

          // Back-compat names used by some UI bits
          totals.total_pause_day_sec  = totals.total_idle_sec;
          totals.total_active_day_sec = totals.total_active_sec;

        } else {
          // week/month/year: generic local window is sufficient
          const w = getLocalWindow(uiPeriod, new Date(), DEFAULTS.timezone) || {};
          if (w.startLocal && w.endLocal) {
            let idle = {};
            try {
              idle = db.prepare(IDLE_IN_WINDOW_SQL).get({
                start_local: w.startLocal,
                end_local:   w.endLocal
              }) || {};
            } catch (e) {
              idle = { total_idle_sec: 0, total_active_sec: 0 };
            }
            totals.total_idle_sec   = Number(idle.total_idle_sec   || 0);
            totals.total_active_sec = Number(idle.total_active_sec || 0);
          } else {
            totals.total_idle_sec = totals.total_active_sec = 0;
          }
        }
      }

      return { rows, totalCount, totals, page, pageSize };
    },
  };
}

module.exports = { ReportsRepo };
