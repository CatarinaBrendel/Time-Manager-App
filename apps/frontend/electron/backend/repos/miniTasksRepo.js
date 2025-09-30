// apps/frontend/electron/backend/repos/miniTasksRepo.js
const dayjs = require('dayjs');

function MiniTasksRepo(db) {
  return {
    async createQuickTask(title) {
      const today = dayjs().format('YYYY-MM-DD');
      const stmt = db.prepare(`
        INSERT INTO tasks (title, priority, due_date, done, status, created_at)
        VALUES (?, 2, ?, 0, 'active', strftime('%s','now'))
      `);
      const info = stmt.run(title, today);
      return db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(info.lastInsertRowid);
    },

    async listActiveDueToday({ limit = 20 } = {}) {
      const today = dayjs().format('YYYY-MM-DD');
      const sql = `
        SELECT * FROM tasks
        WHERE COALESCE(done,0) = 0
          AND date(COALESCE(due_date, date('now','localtime'))) = ?
        ORDER BY COALESCE(priority, 0) DESC, COALESCE(eta_minutes, 999999) ASC
        LIMIT ?
      `;
      return db.prepare(sql).all(today, limit);
    },

    async startTaskTimer(taskId) {
      db.prepare(`
        UPDATE tasks
        SET started_at = COALESCE(started_at, strftime('%s','now')),
            status = 'active'
        WHERE id = ?
      `).run(taskId);
    },

    async pauseTaskTimer(taskId) {
      db.prepare(`
        UPDATE tasks
        SET status = 'paused'
        WHERE id = ?
      `).run(taskId);
    },

    async stopTaskTimer(taskId) {
      db.prepare(`
        UPDATE tasks
        SET done = 1,
            status = 'done',
            completed_at = strftime('%s','now')
        WHERE id = ?
      `).run(taskId);
    },
  };
}

module.exports = { MiniTasksRepo };
