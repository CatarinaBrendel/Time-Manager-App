// tasksRepo.js
// Better-sqlite3 repository for Tasks
// - list/get use v_task_overview so you get effective_sec (excludes pauses) for free
// - start/pause/stop manipulate sessions + session_pauses and enforce status rules
// - create/update manage tags via tags + task_tags

function TasksRepo(db) {
  // -----------------------------
  // Helpers
  // -----------------------------
  const asTask = (row) => {
    if (!row) return null;
    return {
      id: row.id ?? row.task_id,
      title: row.title,
      description: row.description ?? "",
      status: row.status,
      priority: row.priority ?? null,            // label (from view)
      priority_weight: row.priority_weight ?? 0, // numeric weight (from view)
      priority_id: row.priority_id ?? null,      // if present in your view
      project: row.project ?? null,              // label (from view)
      company: row.company ?? null,              // label (from view)
      project_id: row.project_id ?? null,        // if present in your view
      company_id: row.company_id ?? null,        // if present in your view
      eta_sec: row.eta_sec ?? null,
      due_at: row.due_at ?? null,
      started_at: row.started_at ?? null,
      ended_at: row.ended_at ?? null,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      archived_at: row.archived_at ?? null,
      // time rollups:
      total_sec: row.total_sec ?? 0,
      paused_sec: row.paused_sec ?? 0,
      effective_sec: row.effective_sec ?? 0, // <- use this in UI for “Total time spent”
      // tags:
      tags: (row.tags_csv ? row.tags_csv.split(",").filter(Boolean) : []),
    };
  };

  const nowIso = () => new Date().toISOString();

  // -----------------------------
  // View-backed read statements
  // -----------------------------
  const listStmt = db.prepare(`
    SELECT
      v.task_id        AS id,
      v.title,
      t.description,
      v.status,
      v.priority,
      v.priority_weight,
      v.priority_id,          -- if your view exposes it
      v.project,
      v.company,
      v.project_id,           -- if your view exposes it
      v.company_id,           -- if your view exposes it
      v.eta_sec,
      v.due_at,
      v.started_at,
      v.ended_at,
      v.total_sec,
      v.paused_sec,
      v.effective_sec,
      v.tags_csv,
      v.created_at,
      v.updated_at,
      v.archived_at
    FROM v_task_overview v
    LEFT JOIN tasks t ON t.id= v.task_id
    ORDER BY
      CASE WHEN v.status='in progress' THEN 0 ELSE 1 END,
      v.priority_weight DESC,
      COALESCE(v.due_at, '9999-12-31T00:00:00Z') ASC,
      v.created_at DESC
  `);

  const getStmt = db.prepare(`
    SELECT
      v.task_id        AS id,
      v.title,
      t.description,
      v.status,
      v.priority,
      v.priority_weight,
      v.priority_id,
      v.project,
      v.company,
      v.project_id,
      v.company_id,
      v.eta_sec,
      v.due_at,
      v.started_at,
      v.ended_at,
      v.total_sec,
      v.paused_sec,
      v.effective_sec,
      v.tags_csv,
      v.created_at,
      v.updated_at,
      v.archived_at
    FROM v_task_overview v
    LEFT JOIN tasks t ON t.id = v.task_id
    WHERE v.task_id = ?
    LIMIT 1
  `);

  // -----------------------------
  // CRUD (base tables)
  // -----------------------------
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority_id, eta_sec, due_at, started_at, ended_at, created_by)
    VALUES (@project_id, @title, @description, COALESCE(@status,'todo'), @priority_id, @eta_sec, @due_at, @started_at, @ended_at, @created_by)
  `);

  const updateTask = db.prepare(`
    UPDATE tasks
    SET
      project_id  = COALESCE(@project_id, project_id),
      title       = COALESCE(@title, title),
      description = COALESCE(@description, description),
      status      = COALESCE(@status, status),
      priority_id = COALESCE(@priority_id, priority_id),
      eta_sec     = COALESCE(@eta_sec, eta_sec),
      due_at      = COALESCE(@due_at, due_at),
      started_at  = COALESCE(@started_at, started_at),
      ended_at    = COALESCE(@ended_at, ended_at),
      updated_at  = @now
    WHERE id = @id
  `);

  const deleteTask = db.prepare(`DELETE FROM tasks WHERE id = ?`);

  // tags upsert
  const getTag = db.prepare(`SELECT id FROM tags WHERE name = ?`);
  const insTag = db.prepare(`INSERT INTO tags (name) VALUES (?)`);
  const linkTag = db.prepare(`INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)`);
  const unlinkAllTags = db.prepare(`DELETE FROM task_tags WHERE task_id = ?`);

  function ensureTagId(name) {
    const got = getTag.get(name);
    if (got?.id) return got.id;
    const r = insTag.run(name);
    return r.lastInsertRowid;
  }

  // -----------------------------
  // Sessions & pauses (Start/Pause/Stop)
  // -----------------------------
  const openFocus = db.prepare(`
    INSERT INTO sessions (task_id, kind, started_at)
    VALUES (@task_id, 'focus', @now)
  `);

  const getOpenFocus = db.prepare(`
    SELECT id FROM sessions
    WHERE task_id=@task_id AND kind='focus' AND ended_at IS NULL
    ORDER BY id DESC LIMIT 1
  `);

  const closeOpenFocus = db.prepare(`
    UPDATE sessions SET ended_at=@now
    WHERE id = (
      SELECT id FROM sessions
      WHERE task_id=@task_id AND kind='focus' AND ended_at IS NULL
      ORDER BY id DESC LIMIT 1
    )
  `);

  const openPause = db.prepare(`
    INSERT INTO session_pauses (session_id, started_at)
    SELECT id, @now FROM sessions
    WHERE task_id=@task_id AND kind='focus' AND ended_at IS NULL
    ORDER BY id DESC LIMIT 1
  `);

  const closeOpenPause = db.prepare(`
    UPDATE session_pauses SET ended_at=@now
    WHERE id = (
      SELECT sp.id
      FROM session_pauses sp
      JOIN sessions s ON s.id = sp.session_id
      WHERE s.task_id=@task_id
        AND s.kind='focus'
        AND s.ended_at IS NULL
        AND sp.ended_at IS NULL
      ORDER BY sp.id DESC LIMIT 1
    )
  `);

  const setStatus = db.prepare(`
    UPDATE tasks
    SET status=@status,
        started_at = CASE WHEN @status='in progress' AND started_at IS NULL THEN @now ELSE started_at END,
        ended_at   = CASE WHEN @status='done'        AND ended_at   IS NULL THEN @now ELSE ended_at   END,
        updated_at = @now
    WHERE id=@task_id
  `);

  const txStart = db.transaction(({ task_id, now }) => {
    // Is there already an open focus session?
    const open = getOpenFocus.get({ task_id });

    if (open) {
      // We're "resuming": just close any open pause on that session.
      closeOpenPause.run({ task_id, now });
      // keep the same focus session; no new session row
    } else {
      // We're "starting" fresh: open a focus session.
      openFocus.run({ task_id, now });
    }

    // In both cases, enforce status
    setStatus.run({ task_id, status: 'in progress', now });
  });

  const txPause = db.transaction(({ task_id, now }) => {
    // Only act if a focus session is open
    const open = getOpenFocus.get({ task_id });
    if (!open) return; // nothing to pause

    // Toggle pause: if a pause is open, close it; else open a new one
    const changed = closeOpenPause.run({ task_id, now }).changes;
    if (!changed) openPause.run({ task_id, now });
    // status stays 'in progress'
  });

  const txStop = db.transaction(({ task_id, now }) => {
    // Only close things if a session is open
    const open = getOpenFocus.get({ task_id });
    if (open) {
      closeOpenPause.run({ task_id, now });  // close pause if any
      closeOpenFocus.run({ task_id, now });  // close focus session
    }
    setStatus.run({ task_id, status: 'done', now });
  });

  // -----------------------------
  // Public API
  // -----------------------------
  function list(opts = {}) {
    // If you need filters (status/project/search), build dynamic SQL here,
    // or create alternate prepared statements. For now, simple list:
    const rows = listStmt.all();
    return rows.map(asTask);
  }

  function get(id) {
    const row = getStmt.get(id);
    return asTask(row);
  }

  const txCreate = db.transaction((payload) => {
    const now = nowIso();
    const toInsert = {
      project_id: payload.project_id ?? null,
      title: (payload.title || "").trim(),
      description: (payload.description || "") || "",
      status: payload.status || 'todo',
      priority_id: payload.priority_id ?? null,
      eta_sec: payload.eta_sec ?? null,
      due_at: payload.due_at ?? null,
      started_at: payload.started_at ?? null,
      ended_at: payload.ended_at ?? null,
      created_by: payload.created_by ?? null,
    };
    const r = insertTask.run(toInsert);
    const taskId = r.lastInsertRowid;

    // tags
    const tags = Array.from(new Set(payload.tags || [])).filter(Boolean);
    for (const name of tags) {
      const tagId = ensureTagId(name);
      linkTag.run(taskId, tagId);
    }
    return taskId;
  });

  function create(payload) {
    const id = txCreate(payload);
    return get(id);
  }

  const txUpdate = db.transaction((payload) => {
    const now = nowIso();
    // supply ALL named params your UPDATE references
    const defaults = {
      id: null,
      project_id: null,
      title: null,
      description: null,
      status: null,        // << important: present, but null
      priority_id: null,
      eta_sec: null,
      due_at: null,
      started_at: null,
      ended_at: null,
      now,
    };

    updateTask.run({ ...defaults, ...payload, now });
    if (payload.tags) {
      unlinkAllTags.run(payload.id);
      const names = Array.from(new Set(payload.tags)).filter(Boolean);
      for (const name of names) {
        const tagId = ensureTagId(name);
        linkTag.run(payload.id, tagId);
      }
    }
  });

  function update(payload) {
    txUpdate(payload);
    return get(payload.id);
  }

  function remove(id) {
    deleteTask.run(id);
    return { ok: true };
  }

  function start(task_id) {
    txStart({ task_id, now: nowIso() });
    return get(task_id);
  }

  function pause(task_id) {
    txPause({ task_id, now: nowIso() });
    return get(task_id);
  }

  function stop(task_id) {
    txStop({ task_id, now: nowIso() });
    return get(task_id);
  }

  return {
    list,
    get,
    create,
    update,
    delete: remove,
    // timer actions
    start,
    pause,
    stop,
  };
}

module.exports = { TasksRepo };
