// renderer/lib/reportsAPI.js
// Thin, defensive wrapper around the Electron IPC bridge (`window.tm.reports.list`)
// Normalizes the backend response shape so the ReportsView can rely on it.

const ensureFn = () => {
  const fn = window?.tm?.reports?.list;
  if (typeof fn !== "function") {
    const hint =
      "IPC bridge 'tm.reports.list' is not available. " +
      "Check: preload exposes `reports: { list: (...) }` and main has `ipcMain.handle('tm.reports.list', ...)`.";
    const err = new Error(hint);
    err.code = "IPC_MISSING";
    throw err;
  }
  return fn;
};

/**
 * @typedef {Object} ReportRow
 * @property {number|string} id
 * @property {string} title
 * @property {string=} status
 * @property {string=} due_at        ISO string or date-ish
 * @property {string=} project
 * @property {string=} projectColor
 * @property {number=} effective_sec
 * @property {number=} paused_sec
 * @property {string[]=} tags
 */

/**
 * @typedef {Object} ListResponse
 * @property {ReportRow[]} rows
 * @property {number} totalCount
 * @property {number} page
 * @property {number} pageSize
 * @property {{ total_worked_sec?: number, total_paused_sec?: number }} totals
 */

/**
 * Call the backend and normalize the response.
 * @param {Object} params
 * @returns {Promise<ListResponse>}
 */
async function list(params = {}) {
  // Normalize period aliases that the backend might expect.
  const periodAliases = {
    daily: "day",
    day: "day",
    today: "day",
    weekly: "week",
    week: "week",
    monthly: "month",
    month: "month",
  };
  const clean = { ...params };
  if (clean.period && periodAliases[clean.period]) {
    clean.period = periodAliases[clean.period];
  }

  // Trim empty-string filters to avoid over-constraining the query
  if (clean.filters && typeof clean.filters === "object") {
    const f = {};
    for (const [k, v] of Object.entries(clean.filters)) {
      if (v === "" || v === undefined || v === null) continue;
      f[k] = v;
    }
    clean.filters = f;
  }
  const call = ensureFn();
  let res = await call(clean);

  // SMART RETRY: if a period was provided and we got 0 rows, try again without period
  try {
    if ((res?.rows?.length ?? 0) === 0 && clean.period) {
      const { period, ...retryParams } = clean;
      const second = await call(retryParams);
      if ((second?.rows?.length ?? 0) > 0) {
        res = second;
        res.__note = "no-data-with-period; retried without period";
      }
    }
  } catch (_) {}

  const page = Number(res?.page ?? params?.page ?? 1);
  const pageSize = Number(res?.pageSize ?? params?.pageSize ?? 10);
  const rows = Array.isArray(res?.rows) ? res.rows : [];
  const totalCount = Number(
    res?.totalCount ?? (typeof res?.count === "number" ? res.count : rows.length)
  );
  const totals = res?.totals ?? { total_worked_sec: 0, total_paused_sec: 0 };

  // Light normalization to avoid crashes if fields are missing
  const safeRows = rows.map((r) => ({
    id: r.id ?? r.task_id ?? r.taskId ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    title: r.title ?? "(untitled)",
    status: r.status ?? "",
    due_at: r.due_at ?? r.dueAt ?? null,
    project: r.project ?? r.project_name ?? "",
    projectColor: r.projectColor ?? r.project_color ?? undefined,
    effective_sec: typeof r.effective_sec === "number" ? r.effective_sec : Number(r.effective_sec ?? 0),
    paused_sec: typeof r.paused_sec === "number" ? r.paused_sec : Number(r.paused_sec ?? 0),
    tags: Array.isArray(r.tags) ? r.tags : (typeof r.tags === "string" ? r.tags.split(",").map(s => s.trim()).filter(Boolean) : []),
    priority: r.priority ?? r.priority_level ?? r.prio ?? null,
  }));

  return { rows: safeRows, totalCount, page, pageSize, totals };
}

export const reportsAPI = { list };

export default reportsAPI;
