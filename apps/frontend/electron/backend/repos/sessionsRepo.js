function SessionsRepo(db) {
  const startStmt = db.prepare(
    `INSERT INTO sessions (task_id, kind, started_at) VALUES (@task_id, @kind, datetime('now'))`
  );
  const stopStmt  = db.prepare(
    `UPDATE sessions SET ended_at = datetime('now') WHERE id = @id AND ended_at IS NULL`
  );

  // Pauses
  const pauseStartStmt = db.prepare(
    `INSERT INTO session_pauses (session_id, started_at)
     VALUES (@id, datetime('now'))`
  );
  const pauseEndStmt = db.prepare(
    `UPDATE session_pauses
       SET ended_at = datetime('now')
     WHERE session_id = @id AND ended_at IS NULL`
  );

  // Current session with pause state
  const getOpen = db.prepare(
    `SELECT s.*,
            EXISTS(SELECT 1 FROM session_pauses p
                    WHERE p.session_id = s.id AND p.ended_at IS NULL) AS is_paused,
            (SELECT started_at FROM session_pauses p
              WHERE p.session_id = s.id AND p.ended_at IS NULL
              ORDER BY started_at DESC LIMIT 1) AS pause_started_at
       FROM sessions s
      WHERE s.ended_at IS NULL
      ORDER BY s.started_at DESC
      LIMIT 1`
  );

  // Daily rollup using the view from 0003_pauses.sql (includes running sessions)
  const byDayEffective = db.prepare(
    `SELECT date(started_at) AS day,
            SUM(effective_sec) AS effective_sec,
            SUM(total_sec)     AS total_sec,
            SUM(paused_sec)    AS paused_sec
       FROM v_session_time
      GROUP BY date(started_at)
      ORDER BY day DESC
      LIMIT ?`
  );

  return {
    start({ task_id = null, kind = 'focus' }) {
      const r = startStmt.run({ task_id, kind });
      return r.lastInsertRowid;
    },
    stop(id) { stopStmt.run({ id }); },

    // New:
    pause(id)  { pauseStartStmt.run({ id }); },
    resume(id) { pauseEndStmt.run({ id }); },

    current() { return getOpen.get(); },
    summary(days = 14) { return byDayEffective.all(days); }
  };
}

module.exports = { SessionsRepo };
