// electron/backend/repos/reportsRepo.js
const DEFAULT_PAGE_SIZE = 10;

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

function toSqliteLocal(dt) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ` +
         `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

function makeDateWindow(period) {
  if (!period || period === "all") return null;

  const p = String(period).toLowerCase();
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (p) {
    case "day":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "week": {
      const d = (start.getDay() + 6) % 7; // Mon=0
      start.setDate(start.getDate() - d);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 7);
      end.setMilliseconds(-1);
      break;
    }
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);
      end.setMilliseconds(-1);
      break;
    default:
      return null;
  }

  return {
    start_s: Math.floor(start.getTime() / 1000), // local window start in epoch seconds
    end_s:   Math.floor(end.getTime()   / 1000), // local window end in epoch seconds
  };
}

function ReportsRepo(db) {
  const baseWhere = (f = {}) => {
    const clauses = [];
    const params = {};

    if (f.title)   { clauses.push('LOWER(title) LIKE LOWER(@title)'); params.title = `%${f.title}%`; }
    if (f.status)  { clauses.push('status = @status'); params.status = f.status; }
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

  const LIST_SQL = `
    SELECT
      task_id AS id,
      title,
      status,
      due_at,
      project,
      effective_sec,
      paused_sec,
      priority,           -- label from the view
      priority_weight     -- numeric sort key from the view
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

  return {
    list(opts = {}) {
      const page = Math.max(1, Number(opts.page || 1));
      const pageSize = Math.max(1, Math.min(Number(opts.pageSize || DEFAULT_PAGE_SIZE), 100));
      const strictDayPauses = String(opts.period).toLowerCase() === "day";

      const { where, params } = baseWhere({
        title:     opts.filters?.title,
        status:    opts.filters?.status,
        projectId: opts.filters?.projectId,
        noProject: opts.filters?.noProject,     // ← pass it through
        //period:    opts.period,
        tag:       opts.filters?.tag,
      });

      const win = makeDateWindow(opts.period);

      const order = `${mapSort(opts.sort)} ${DIR(opts.dir)}`;

      const rows = db.prepare(
        LIST_SQL.replace('%WHERE%', where).replace('%ORDER%', order)
      ).all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

      const totalCount = db.prepare(COUNT_SQL.replace('%WHERE%', where)).get(params).n;

      // All-time totals from the view (may not be window-aware)
      const totals = db.prepare(TOTALS_SQL.replace('%WHERE%', where)).get(params);

      // If a window is active, recompute worked/paused with overlap (window-aware)
      if (win) {
      const WINDOW_TOTALS_SQL = `
      WITH
        win AS (
          SELECT
            CAST(@start_s AS INTEGER) AS start_s,
            CAST(@end_s   AS INTEGER) AS end_s
        ),
        matching_tasks AS (
          SELECT task_id
          FROM v_task_overview
          %WHERE%
        ),
        -- Sessions -> epoch (robust parsing)
        norm_sessions AS (
          SELECT
            s.id AS session_id,
            s.task_id,
            CAST(
              COALESCE(
                strftime('%s', s.started_at),
                strftime('%s', REPLACE(REPLACE(s.started_at,'T',' '),'Z',''))
              ) AS INTEGER
            ) AS s_start_s,
            CAST(
              COALESCE(
                strftime('%s', COALESCE(s.ended_at, 'now')),
                strftime('%s', REPLACE(REPLACE(COALESCE(s.ended_at, 'now'),'T',' '),'Z',''))
              ) AS INTEGER
            ) AS s_end_s
          FROM sessions s
          JOIN matching_tasks mt ON mt.task_id = s.task_id
          WHERE s.kind = 'focus'
        ),
        -- Pauses -> epoch (robust parsing)
        norm_pauses AS (
          SELECT
            sp.session_id,
            CAST(
              COALESCE(
                strftime('%s', sp.started_at),
                strftime('%s', REPLACE(REPLACE(sp.started_at,'T',' '),'Z',''))
              ) AS INTEGER
            ) AS p_start_s,
            CAST(
              COALESCE(
                strftime('%s', COALESCE(sp.ended_at, 'now')),
                strftime('%s', REPLACE(REPLACE(COALESCE(sp.ended_at, 'now'),'T',' '),'Z',''))
              ) AS INTEGER
            ) AS p_end_s
          FROM session_pauses sp
          WHERE EXISTS (SELECT 1 FROM norm_sessions ns WHERE ns.session_id = sp.session_id)
        ),
        -- Session overlap with the window
        session_overlaps AS (
          SELECT
            ns.session_id,
            MAX(0, MIN(ns.s_end_s, (SELECT end_s FROM win)) - MAX(ns.s_start_s, (SELECT start_s FROM win))) AS session_overlap
          FROM norm_sessions ns
          WHERE ns.s_start_s < (SELECT end_s FROM win)
            AND ns.s_end_s   > (SELECT start_s FROM win)
          GROUP BY ns.session_id
        ),
        -- Pause overlap clamped to BOTH the session and the window
        pause_overlaps_raw AS (
          SELECT
            ns.session_id,
            MAX(
              0,
              MIN(np.p_end_s, ns.s_end_s, (SELECT end_s FROM win))
              - MAX(np.p_start_s, ns.s_start_s, (SELECT start_s FROM win))
            ) AS paused_overlap
          FROM norm_pauses np
          JOIN norm_sessions ns ON ns.session_id = np.session_id
          WHERE np.p_start_s < (SELECT end_s FROM win)
            AND np.p_end_s   > (SELECT start_s FROM win)
            ${strictDayPauses ? "AND np.p_start_s >= (SELECT start_s FROM win)" : ""}
          GROUP BY ns.session_id, np.p_start_s, np.p_end_s
        ),
        -- Sum pauses per session
        pause_overlaps AS (
          SELECT session_id, SUM(paused_overlap) AS paused_sum
          FROM pause_overlaps_raw
          GROUP BY session_id
        )
      SELECT
        -- Total focused time inside the window
        COALESCE((SELECT SUM(session_overlap) FROM session_overlaps), 0) AS total_session_sec,
        -- Total paused time, capped so it can never exceed the session overlap per session
        COALESCE((
          SELECT SUM(
            CASE
              WHEN po.paused_sum > so.session_overlap THEN so.session_overlap
              ELSE po.paused_sum
            END
          )
          FROM session_overlaps so
          LEFT JOIN pause_overlaps po ON po.session_id = so.session_id
        ), 0) AS total_paused_sec;
    `;

      const windowParams = { ...params, start_s: win.start_s, end_s: win.end_s };
      const row = db.prepare(WINDOW_TOTALS_SQL.replace('%WHERE%', where)).get(windowParams);
      const totalSessionSec = Number(row?.total_session_sec ?? 0);
      const totalPausedSec  = Number(row?.total_paused_sec  ?? 0);

      totals.total_paused_sec = totalPausedSec;
      totals.total_worked_sec = Math.max(0, totalSessionSec - totalPausedSec);
    }

      return { rows, totalCount, totals, page, pageSize };
    },
  };
}

module.exports = { ReportsRepo };
