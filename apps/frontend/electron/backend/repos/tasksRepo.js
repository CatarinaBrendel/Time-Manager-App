function TasksRepo(db) {
const insert = db.prepare(`INSERT INTO tasks (title, description, due_at, tags_json) VALUES (@title, @description, @due_at, @tags_json)`);
const update = db.prepare(`UPDATE tasks SET
title = COALESCE(@title, title),
description = COALESCE(@description, description),
status = COALESCE(@status, status),
due_at = COALESCE(@due_at, due_at),
tags_json = COALESCE(@tags_json, tags_json),
updated_at = datetime('now')
WHERE id = @id`);
const get = db.prepare(`SELECT *, json(tags_json) AS tags FROM tasks WHERE id = ?`);
const list = db.prepare(`SELECT id, title, status, due_at, created_at, updated_at FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?`);
const remove = db.prepare(`DELETE FROM tasks WHERE id = ?`);

return {
create(data) {
const run = insert.run({
title: data.title,
description: data.description ?? '',
due_at: data.due_at ?? null,
tags_json: JSON.stringify(data.tags ?? [])
});
return run.lastInsertRowid;
},
update(partial) {
update.run({
id: partial.id,
title: partial.title ?? null,
description: partial.description ?? null,
status: partial.status ?? null,
due_at: partial.due_at ?? null,
tags_json: partial.tags ? JSON.stringify(partial.tags) : null,
});
},
get(id) { return get.get(id); },
list(limit = 50, offset = 0) { return list.all(limit, offset); },
delete(id) { remove.run(id); }
};
}

module.exports = { TasksRepo };