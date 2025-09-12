// apps/frontend/electron/backend/db/TasksRepo.js
function TasksRepo(db) {
  // ---------- helpers ----------
  const asTagsArray = (csv) => (csv ? csv.split(',') : []);

  const upsertTag = db.prepare(`INSERT OR IGNORE INTO tags(name) VALUES (?)`);
  const getTagId  = db.prepare(`SELECT id FROM tags WHERE name = ?`);
  const linkTag   = db.prepare(`INSERT OR IGNORE INTO task_tags(task_id, tag_id) VALUES (?, ?)`);
  const clearTags = db.prepare(`DELETE FROM task_tags WHERE task_id = ?`);

  const setTaskTagsTx = db.transaction((taskId, tags) => {
    clearTags.run(taskId);
    for (const raw of tags || []) {
      const name = String(raw).trim();
      if (!name) continue;
      upsertTag.run(name);
      const row = getTagId.get(name);
      if (row?.id) linkTag.run(taskId, row.id);
    }
  });

  // ---------- statements ----------
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      title, description, status, due_at,
      project_id, priority_id, eta_sec, started_at, ended_at
    )
    VALUES (
      @title, @description, 'todo', @due_at,
      @project_id, @priority_id, @eta_sec, @started_at, @ended_at
    )
  `);

  const updateTask = db.prepare(`
    UPDATE tasks SET
      title        = COALESCE(@title, title),
      description  = COALESCE(@description, description),
      status       = COALESCE(@status, status),
      due_at       = COALESCE(@due_at, due_at),
      project_id   = COALESCE(@project_id, project_id),
      priority_id  = COALESCE(@priority_id, priority_id),
      eta_sec      = COALESCE(@eta_sec, eta_sec),
      started_at   = COALESCE(@started_at, started_at),
      ended_at     = COALESCE(@ended_at, ended_at),
      updated_at   = datetime('now')
    WHERE id = @id
  `);
    
  const popularTagsStmt = db.prepare(`
    SELECT tg.name, COUNT(*) AS freq
    FROM tags tg
    JOIN task_tags tt ON tt.tag_id = tg.id
    GROUP BY tg.id
    ORDER BY freq DESC, tg.name ASC
    LIMIT @limit
  `);

  const baseSelect = `
    SELECT
      t.id, t.title, t.description, t.status, t.due_at,
      t.project_id, p.name AS project,
      c.id AS company_id, c.name AS company,
      t.priority_id, pr.label AS priority, pr.weight AS priority_weight,
      t.eta_sec, t.started_at, t.ended_at,
      t.created_at, t.updated_at, t.archived_at,
      GROUP_CONCAT(tag.name, ',') AS tags_csv
    FROM tasks t
    LEFT JOIN projects  p   ON p.id = t.project_id
    LEFT JOIN companies c   ON c.id = p.company_id
    LEFT JOIN priorities pr ON pr.id = t.priority_id
    LEFT JOIN task_tags tt  ON tt.task_id = t.id
    LEFT JOIN tags tag      ON tag.id = tt.tag_id
  `;

  const baseFrom = `
    FROM tasks t
    LEFT JOIN projects  p   ON p.id = t.project_id
    LEFT JOIN companies c   ON c.id = p.company_id
    LEFT JOIN priorities pr ON pr.id = t.priority_id
  `;

  const mapRow = (row) => row && {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    due_at: row.due_at,
    project_id: row.project_id ?? null,
    project: row.project ?? null,
    company_id: row.company_id ?? null,
    company: row.company ?? null,
    priority_id: row.priority_id ?? null,
    priority: row.priority ?? null,
    priority_weight: row.priority_weight ?? null,
    eta_sec: row.eta_sec ?? null,
    started_at: row.started_at ?? null,
    ended_at: row.ended_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at ?? null,
    tags: asTagsArray(row.tags_csv),
  };

  // ---------- filter builder ----------
  function buildWhereAndParams(f = {}) {
    const where = [];
    const params = {};

    // status (string or array)
    if (f.status) {
      if (Array.isArray(f.status)) {
        const keys = f.status.map((_, i) => `@status${i}`);
        f.status.forEach((s, i) => (params[`status${i}`] = s));
        where.push(`t.status IN (${keys.join(',')})`);
      } else {
        params.status = f.status;
        where.push(`t.status = @status`);
      }
    }

    if (f.project_id != null) {
      params.project_id = f.project_id;
      where.push(`t.project_id = @project_id`);
    }
    if (f.company_id != null) {
      params.company_id = f.company_id;
      where.push(`c.id = @company_id`);
    }
    if (f.priority_id != null) {
      params.priority_id = f.priority_id;
      where.push(`t.priority_id = @priority_id`);
    }

    // search (title/description)
    if (f.q && String(f.q).trim()) {
      params.q = `%${String(f.q).toLowerCase()}%`;
      where.push(`(LOWER(t.title) LIKE @q OR LOWER(t.description) LIKE @q)`);
    }

    // date ranges
    if (f.due_from) { params.due_from = f.due_from; where.push(`t.due_at >= @due_from`); }
    if (f.due_to)   { params.due_to   = f.due_to;   where.push(`t.due_at <  @due_to`);   }
    if (f.created_from){ params.created_from = f.created_from; where.push(`t.created_at >= @created_from`); }
    if (f.created_to)  { params.created_to   = f.created_to;   where.push(`t.created_at <  @created_to`);   }
    if (f.started_from){ params.started_from = f.started_from; where.push(`t.started_at >= @started_from`); }
    if (f.started_to)  { params.started_to   = f.started_to;   where.push(`t.started_at <  @started_to`);   }

    // has_sessions (focus sessions)
    if (typeof f.has_sessions === 'boolean') {
      if (f.has_sessions) {
        where.push(`EXISTS (SELECT 1 FROM sessions s WHERE s.task_id = t.id AND s.kind='focus')`);
      } else {
        where.push(`NOT EXISTS (SELECT 1 FROM sessions s WHERE s.task_id = t.id AND s.kind='focus')`);
      }
    }

    // tag filters
    // - tag: single string (alias for tags: [tag])
    // - tags: array of strings
    // - tagMode: 'any' (default) | 'all'
    const tags = f.tag ? [f.tag] : Array.isArray(f.tags) ? f.tags : null;
    const tagMode = f.tagMode === 'all' ? 'all' : 'any';
    if (tags && tags.length > 0) {
      if (tagMode === 'any') {
        // ANY match
        const keys = tags.map((_, i) => `@tag${i}`);
        tags.forEach((tname, i) => (params[`tag${i}`] = String(tname)));
        where.push(`
          EXISTS (
            SELECT 1 FROM task_tags ttx
            JOIN tags tgx ON tgx.id = ttx.tag_id
            WHERE ttx.task_id = t.id AND tgx.name IN (${keys.join(',')})
          )
        `);
      } else {
        // ALL match: count of distinct matched tag names must equal tags.length
        const keys = tags.map((_, i) => `@tag${i}`);
        tags.forEach((tname, i) => (params[`tag${i}`] = String(tname)));
        where.push(`
          (
            SELECT COUNT(DISTINCT tgx.name)
            FROM task_tags ttx
            JOIN tags tgx ON tgx.id = ttx.tag_id
            WHERE ttx.task_id = t.id AND tgx.name IN (${keys.join(',')})
          ) = ${tags.length}
        `);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return { whereSql, params };
  }

  // ---------- sorting ----------
  const ORDER_COLUMNS = {
    created_at: 't.created_at',
    updated_at: 't.updated_at',
    due_at: 't.due_at',
    title: 't.title',
    status: 't.status',
    priority_weight: 'pr.weight',
    started_at: 't.started_at',
    ended_at: 't.ended_at',
  };

  function buildOrderBy(f = {}) {
    const key = (f.sortBy && ORDER_COLUMNS[f.sortBy]) ? f.sortBy : 'created_at';
    const col = ORDER_COLUMNS[key];
    const dir = (f.sortDir && String(f.sortDir).toLowerCase() === 'asc') ? 'ASC' : 'DESC';
    // Keep secondary sort for stable ordering
    if (key === 'priority_weight') {
      return `ORDER BY ${col} ${dir}, t.created_at DESC`;
    }
    return `ORDER BY ${col} ${dir}`;
  }

  // ---------- public API ----------
  return {
    // CREATE
    create(data) {
      const tx = db.transaction(() => {
        const res = insertTask.run({
          title: data.title,
          description: data.description ?? '',
          due_at: data.due_at ?? null,
          project_id: data.project_id ?? null,
          priority_id: data.priority_id ?? null,
          eta_sec: data.eta_sec ?? null,
          started_at: data.started_at ?? null,
          ended_at: data.ended_at ?? null,
        });
        const id = Number(res.lastInsertRowid);
        if (data.tags) setTaskTagsTx(id, data.tags);
        return id;
      });
      const id = tx();
      return this.get(id);
    },

    // UPDATE
    update(partial) {
      const tx = db.transaction(() => {
        updateTask.run({
          id: partial.id,
          title: partial.title ?? null,
          description: partial.description ?? null,
          status: partial.status ?? null,
          due_at: partial.due_at ?? null,
          project_id: partial.project_id ?? null,
          priority_id: partial.priority_id ?? null,
          eta_sec: partial.eta_sec ?? null,
          started_at: partial.started_at ?? null,
          ended_at: partial.ended_at ?? null,
        });
        if (partial.tags !== undefined) {
          setTaskTagsTx(partial.id, partial.tags || []);
        }
      });
      tx();
      return this.get(partial.id);
    },

    // GET single
    get(id) {
      const stmt = db.prepare(`${baseSelect} WHERE t.id = ? GROUP BY t.id`);
      const row = stmt.get(id);
      return mapRow(row);
    },

    // LIST with filters, sorting, pagination
    // opts = {
    //   status, project_id, company_id, priority_id,
    //   tag, tags, tagMode: 'any'|'all',
    //   q, due_from, due_to, created_from, created_to, started_from, started_to,
    //   has_sessions: true|false,
    //   sortBy, sortDir, limit=50, offset=0
    // }
    list(opts = {}) {
      const { whereSql, params } = buildWhereAndParams(opts);
      const orderBy = buildOrderBy(opts);
      const limit = Number.isFinite(opts.limit) ? Math.max(0, opts.limit) : 50;
      const offset = Number.isFinite(opts.offset) ? Math.max(0, opts.offset) : 0;

      // Items
      const listSql = `
        ${baseSelect}
        ${whereSql}
        GROUP BY t.id
        ${orderBy}
        LIMIT @limit OFFSET @offset
      `;
      const items = db
        .prepare(listSql)
        .all({ ...params, limit, offset })
        .map(mapRow);

      // Total (use DISTINCT t.id to avoid join fan-out)
      const countSql = `
        SELECT COUNT(DISTINCT t.id) AS cnt
        ${baseFrom}
        ${whereSql}
      `;
      const total = db.prepare(countSql).get(params).cnt;

      return { items, total };
    },

    // DELETE
    delete(id) {
      db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
      return { ok: true };
    },

    listTags(prefix = "", limit = 10) {
      if (!prefix) {
        return this.popularTags(limit).map(t => t.name);
      }
      const p = String(prefix).toLowerCase();

      // small table, simple + predictable
      const names = db.prepare(`SELECT name FROM tags`).all().map(r => r.name || "");

      const out = [];
      for (const n of names) {
        if (n.toLowerCase().startsWith(p)) {
          out.push(n);
          if (out.length >= limit) break;
        }
      }
      // keep some reasonable order
      out.sort((a, b) => a.localeCompare(b));
      return out;
    },


    popularTags(limit = 10) {
      return popularTagsStmt.all({ limit });
    },
  };
}

module.exports = { TasksRepo };
