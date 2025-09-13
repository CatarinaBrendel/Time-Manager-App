// apps/frontend/renderer/src/lib/tasksAPI.js
export const tasksAPI = {
  list:  (opts) => window.tm.tasks.list(opts),
  get:   (id)   => window.tm.tasks.get(id),
  create:(p)    => window.tm.tasks.create(p),
  update:(p)    => window.tm.tasks.update(p),
  delete:(id)   => window.tm.tasks.delete(id),
  start: (id)   => window.tm.tasks.start(id),
  pause: (id)   => window.tm.tasks.pause(id),
  stop:  (id)   => window.tm.tasks.stop(id),
};

export const tagsAPI = {
  list: () => window.tm.tags.list(),
};

