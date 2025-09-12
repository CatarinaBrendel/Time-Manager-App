// apps/frontend/renderer/src/lib/taskCreateAdapter.js

// If your DB has priorities seeded like (1=low, 2=medium, 3=high),
// set the IDs here. If unknown, leave null to let DB default/null.
//const PRIORITY_ID_BY_LABEL = {
//  low: 1,
//  medium: 2,
//  high: 3,
//};

const PRIORITY_ID_BY_LABEL = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

export function toRepoCreatePayload(modal) {
  // modal shape from NewTaskModal: { title, description, project, priority, tags, dueDate }
  // repo.create expects: { title, description, due_at, project_id, priority_id, eta_sec, started_at, ended_at, tags }
  const key = (modal.priority || "").toString().toLowerCase();
  const priority_id = PRIORITY_ID_BY_LABEL[key] ?? null;

  return {
    title: modal.title,
    description: modal.description ?? "",
    due_at: modal.dueDate ?? null,
    project_id: null, // TODO: resolve/create project by name when project API is ready
    priority_id,
    eta_sec: null,
    started_at: null,
    ended_at: null,
    tags: Array.isArray(modal.tags) ? modal.tags : [],
  };
}
