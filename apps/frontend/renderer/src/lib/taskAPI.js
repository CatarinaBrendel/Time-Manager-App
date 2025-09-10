// apps/frontend/renderer/src/lib/tasksAPI.js
export const tasksAPI = {
  list:  (opts) => window.tm.tasks.list(opts),
  get:   (id)   => window.tm.tasks.get(id),
  create:(p)    => window.tm.tasks.create(p),
  update:(p)    => window.tm.tasks.update(p),
  delete:(id)   => window.tm.tasks.delete(id),
};
