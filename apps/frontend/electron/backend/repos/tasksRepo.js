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

  // helpers (top of tasksRepo.js)
  const getPriorityIdByLabel = db.prepare(
    `SELECT id FROM priorities WHERE LOWER(label)=LOWER(?) LIMIT 1`
  );
  const ensureDefaults = () => {
    // seed priorities if table is empty (saves you from missing seeds in dev)
    const c = db.prepare(`SELECT COUNT(*) AS n FROM priorities`).get().n;
    if (!c) {
      db.prepare(`INSERT INTO priorities(label,weight) VALUES 
        ('low',1),('medium',2),('high',3),('urgent',4)`).run();
    }
  };
  const toNullableId = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  ensureDefaults();
 
  const getTagIdByName = db.prepare(`SELECT id FROM tags WHERE LOWER(name)=LOWER(?) LIMIT 1`);
  const insertTag       = db.prepare(`INSERT INTO tags (name) VALUES (?)`);
  function ensureTagId(name) {
    const n = String(name || '').trim();
    if (!n) return null;
    const got = getTagIdByName.get(n);
    if (got?.id) return got.id;
    return insertTag.run(n).lastInsertRowid;
  }

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
    INSERT INTO tasks (
      project_id, title, description, status,
      priority_id, eta_sec, due_at,
      started_at, ended_at,
      created_at, updated_at
    ) VALUES (
      @project_id, @title, @description, COALESCE(@status,'todo'),
      @priority_id, @eta_sec, @due_at,
      @started_at, @ended_at,
      @now, @now
    )
  `);

  const updateTask = db.prepare(`
    UPDATE tasks SET
      project_id  = COALESCE(@project_id,  project_id),
      title       = COALESCE(@title,       title),
      description = COALESCE(@description, description),
      status      = COALESCE(@status,      status),
      priority_id = COALESCE(@priority_id, priority_id),
      eta_sec     = COALESCE(@eta_sec,     eta_sec),
      due_at      = COALESCE(@due_at,      due_at),
      started_at  = COALESCE(@started_at,  started_at),
      ended_at    = COALESCE(@ended_at,    ended_at),
      updated_at  = @now
    WHERE id = @id
  `);

    // Return the enriched view row (adjust view name/columns if different)
  const getTaskView = db.prepare(`SELECT * FROM v_task_overview WHERE task_id = ?`);

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
    // 0) Ensure no other open focus sessions conflict with the "one open" rule
    const open = findOpenFocusAny.all();
    for (const s of open) {
      if (s.task_id === task_id) continue; // same task: will resume below

      // If another task has an *open paused* session, close it cleanly
      const paused = !!hasOpenPauseBySession.get(s.id);
      if (paused) {
        closePauseBySession.run({ session_id: s.id, now });
        closeFocusById.run({ session_id: s.id, now });
      } else {
        // Another task is actively running -> ask user to pause/stop it first
        throw new Error('Another task is currently running. Please pause or stop it first.');
      }
    }

    // 1) For the current task: resume if session exists, else open a new one
    const openCurrent = getOpenFocus.get({ task_id });
    if (openCurrent) {
      // resume = close open pause on this session
      closeOpenPause.run({ task_id, now });
    } else {
      openFocus.run({ task_id, now });
    }

    // 2) Ensure status is "in progress"
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

  // Find any open focus sessions (global)
  const findOpenFocusAny = db.prepare(`
    SELECT id, task_id
    FROM sessions
    WHERE kind='focus' AND ended_at IS NULL
  `);

  // Is a given session currently paused? (has an open pause row)
  const hasOpenPauseBySession = db.prepare(`
    SELECT 1
    FROM session_pauses
    WHERE session_id = ? AND ended_at IS NULL
    LIMIT 1
  `);

  // Close pause by session id
  const closePauseBySession = db.prepare(`
    UPDATE session_pauses
    SET ended_at = @now
    WHERE session_id = @session_id AND ended_at IS NULL
  `);

  // Close focus session by id
  const closeFocusById = db.prepare(`
    UPDATE sessions
    SET ended_at = @now
    WHERE id = @session_id AND ended_at IS NULL
  `);


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
    const now = new Date().toISOString();

    // Normalize inputs
    let project_id  = toNullableId(payload.project_id);
    let priority_id = toNullableId(payload.priority_id);
    if (!priority_id && payload.priority) {
      const row = getPriorityIdByLabel.get(String(payload.priority));
      priority_id = row?.id ?? null;
    }

    const eta_sec  = Number.isFinite(Number(payload.eta_sec)) ? Number(payload.eta_sec) : null;
    const due_at   = payload.due_at ?? null;

    const title = String(payload.title || '').trim();
    const description = String(payload.description || '');
    if (!title) throw new Error('Title required');

    // Insert task (pass ALL named params)
    const res = insertTask.run({
      project_id,
      title,
      description,
      status: null,          // keep via COALESCE -> 'todo'
      priority_id,
      eta_sec,
      due_at,
      started_at: null,
      ended_at: null,
      now,
    });
    const task_id = Number(res.lastInsertRowid);

    // Tags
    if (Array.isArray(payload.tags) && payload.tags.length) {
      const uniq = [...new Set(payload.tags.map(String))];
      for (const name of uniq) {
        const tagId = ensureTagId(name);
        if (tagId) linkTag.run(task_id, tagId);
      }
    }

    return task_id;
  });

  // Public create() wrapper that returns the view row
  function create(payload) {
    const id = txCreate(payload);
    return getTaskView.get(id);
  }

  const txUpdate = db.transaction((payload) => {
    const now = new Date().toISOString();

    // Provide defaults for every named param referenced in updateTask
    const defaults = {
      id: null,
      project_id: null,
      title: null,
      description: null,
      status: null,        // status stays unchanged unless explicitly set (Start/Stop manage it)
      priority_id: null,
      eta_sec: null,
      due_at: null,
      started_at: null,
      ended_at: null,
      now,
    };

    // Normalize FKs
    let project_id  = toNullableId(payload.project_id);
    let priority_id = toNullableId(payload.priority_id);
    if (!priority_id && payload.priority) {
      const row = getPriorityIdByLabel.get(String(payload.priority));
      priority_id = row?.id ?? null;
    }

    const eta_sec  = Number.isFinite(Number(payload.eta_sec)) ? Number(payload.eta_sec) : null;
    const data = {
      ...defaults,
      ...payload,
      project_id,
      priority_id,
      eta_sec,
      now,
    };

    updateTask.run(data);

    // Tags: if tags provided, replace set
    if (Array.isArray(payload.tags)) {
      unlinkAllTags.run(payload.id);
      const uniq = [...new Set(payload.tags.map(String))];
      for (const name of uniq) {
        const tagId = ensureTagId(name);
        if (tagId) linkTag.run(payload.id, tagId);
      }
    }
  });

  // Public update() wrapper that returns the view row
  function update(payload) {
    txUpdate(payload);
    return getTaskView.get(payload.id);
  }


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
