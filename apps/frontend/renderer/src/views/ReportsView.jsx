// views/ReportsView.jsx
import React, { useEffect, useMemo, useState, useReducer } from "react";
import { reportsAPI } from "../lib/reportsAPI";
import { projectsAPI } from "../lib/projectsAPI";
import Toolbar, { STATUS_OPTIONS as DEFAULT_STATUS_OPTIONS } from "../ui/Toolbar";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatDuration } from "../helpers/helpersFunctions";

// Debounce helper
function useDebounced(value, delay = 250) {
  const [v, dispatch] = useReducer((_, x) => x, value);
  useEffect(() => {
    const id = setTimeout(() => dispatch(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

const initial = {
  period: "daily",
  query: "",
  sortKey: "due_at",
  dir: "ASC",
  page: 1,
  status: "all",
  project: "",
  tag: "",
  priority: ""
};

function reducer(state, action) {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "patchReset":
      return { ...state, ...action.patch, page: 1 };
    default:
      return state;
  }
}

// map Toolbar sort keys -> repo columns
const mapSortKey = (k) => (k === "priority" ? "effective_sec" : k === "eta" ? "due_at" : k);

export default function ReportsView() {
  const [params, dispatch] = useReducer(reducer, initial);
  const { period, query, sortKey, dir, page, status, project, tag, priority } = params;
  const pageSize = 10;
  const queryDeb = useDebounced(query, 250);

  const [data, setData] = useState({ rows: [], totalCount: 0, page: 1, pageSize, totals: {total_worked_sec: 0, total_paused_sec: 0} });
  const [loading, setLoading] = useState(false);

  // populates the project sorting field
  const [projects, setProjects] = useState([]);
  const NO_PROJECT = "__none__";
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await projectsAPI.list();
        if (!cancelled) setProjects(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.warn("projectsAPI.list failed", e);
        if (!cancelled) setProjects([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // fetching the data
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        const res = await reportsAPI.list({
          period,
          page,
          pageSize,
          sort: sortKey,
          dir,
          filters: {
            title: queryDeb,
            status: status === "all" ? "" : status,
            projectId: project && project !== NO_PROJECT ? project : undefined,
            noProject: project === NO_PROJECT ? true : undefined,
            tag: tag || undefined,
            priority: priority || undefined
          },
        });
        if (!cancelled) setData(res);
      } catch (err) {
        console.error("reports.list failed", err);
        if (!cancelled) {
          setData((d) => ({ ...d, rows: [], totalCount: 0 }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // include every input that changes the query
  }, [period, page, pageSize, sortKey, dir, queryDeb, status, project, tag, priority]);

  const items = useMemo(() => data?.rows ?? [], [data]);

  // Pagination helpers
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const pageCount = Math.max(1, Math.ceil((data?.totalCount ?? 0) / (pageSize || 10)));
  const pageNumbers = React.useMemo(() => {
    const p = page || 1;
    const t = pageCount;
    const delta = 1; // how many neighbors to show around current page
    const out = [];
    const left = Math.max(1, p - delta);
    const right = Math.min(t, p + delta);

    if (left > 1) out.push(1);
    if (left > 2) out.push("…");
    for (let i = left; i <= right; i++) out.push(i);
    if (right < t - 1) out.push("…");
    if (right < t) out.push(t);

    return out;
  }, [page, pageCount]);

  const setPage = (p) => dispatch({ type: "patch", patch: { page: typeof p === "function" ? p(page) : p } });

  // Go-to input
  const [gotoVal, setGotoVal] = React.useState("");
  
  const sortValue = `${sortKey}-${dir.toLowerCase()}`;

  // Prefer backend totals (whole filtered dataset). Fallback to current page sum.
  const pageWorked = useMemo(() => items.reduce((s, r) => s + (Number(r.effective_sec || 0)), 0), [items]);
  const pagePaused = useMemo(() => items.reduce((s, r) => s + (Number(r.paused_sec || 0)), 0), [items]);

  const totalWorkedSec = Number(data?.totals?.total_worked_sec ?? 0) || pageWorked;
  const totalPausedSec = Number(data?.totals?.total_paused_sec ?? 0) || pagePaused;

  // helpers
  const setAndReset = (patch) => dispatch({ type: "patchReset", patch });
  const priorityLabel = (p) => {
    console.log("p:", p);
    if (p == null) return "—";
    if (typeof p === "number") {
      return ({1:"Low",2:"Medium",3:"High",4:"Urgent"}[p] || String(p));
    }
    const s = String(p).trim().toLowerCase();
    return s ? s[0].toUpperCase() + s.slice(1) : "—";
  };

  const priorityClass = (p) => {
    const key = typeof p === "number" ? p :
      ({low:1, medium:2, high:3, urgent:4}[String(p).toLowerCase()] ?? 0);
    switch (key) {
      case 1: return "border-slate-300 text-slate-700";
      case 2: return "border-amber-300 text-amber-700";
      case 3: return "border-orange-300 text-orange-700";
      case 4: return "border-red-300 text-red-700";
      default: return "border-slate-200 text-slate-500";
    }
  };

  const counts = useMemo(() => {
    const c = { todo: 0, "in progress": 0, done: 0 };
    for (const r of items) {
      const s = (r.status || "").toLowerCase();
      if (s in c) c[s] += 1;
    }
    return c;
  }, [items]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col text-slate-900 overflow-hidden">
      {/* Toolbar (legacy props) */}
      <div className="shrink-0">
        <div className="mx-auto max-w-6xl py-3">
          <div className="rounded-2xl bg-white shadow-sm">
            <div className="">
              <Toolbar
                query={query}
                setQuery={(q) => setAndReset({ query: q })}
                status={status}
                setStatus={(s) => setAndReset({ status: s })}
                project={project}
                setProject={(p) => setAndReset({ project: p })}
                tag={tag}
                setTag={(t) => setAndReset({ tag: t })}
                sort={sortValue}
                setSort={(v) => {
                  const [key, direction] = String(v).split("-");
                  setAndReset({ sortKey: mapSortKey(key), dir: (direction || "asc").toUpperCase() });
                }}
                counts={counts}
                projects={projects}
                statusOptions={DEFAULT_STATUS_OPTIONS}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-auto rounded-2xl bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header with sortable cells */}
            <div className="grid grid-cols-[1.6fr_0.6fr_0.4fr_0.8fr_0.4fr] px-5 py-2 text-sm font-medium text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
              <HeaderCell label="Title" sortKey="title" sort={sortKey} dir={dir} align="left"
                onSort={(k) => setAndReset({ sortKey: k, dir: sortKey === k && dir === "ASC" ? "DESC" : "ASC" })} />
              <HeaderCell label="Worked" sortKey="effective_sec" sort={sortKey} dir={dir} align="center"
                onSort={(k) => setAndReset({ sortKey: k, dir: sortKey === k && dir === "ASC" ? "DESC" : "ASC" })} />
              <HeaderCell label="Status" sortKey="status" sort={sortKey} dir={dir} align="center"
                onSort={(k) => setAndReset({ sortKey: k, dir: sortKey === k && dir === "ASC" ? "DESC" : "ASC" })} />
              <HeaderCell label="Due Date" sortKey="due_at" sort={sortKey} dir={dir} align="center"
                onSort={(k) => setAndReset({ sortKey: k, dir: sortKey === k && dir === "ASC" ? "DESC" : "ASC" })} />
              <HeaderCell label="Priority" sortKey="priority" sort={sortKey} dir={dir} align="center"
                onSort={(k) => setAndReset({ sortKey: k, dir: sortKey === k && dir === "ASC" ? "DESC" : "ASC" })} />
            </div>

            {loading && <div className="p-8 text-center text-slate-500">Loading…</div>}
            {!loading && items.map((r) => (
              <div key={r.id} className="grid grid-cols-[1.6fr_0.6fr_0.4fr_0.8fr_0.4fr] px-5 py-2 items-center border-b border-slate-200 last:border-b-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.title}</div>
                </div>
                <div className="text-sm text-slate-700 text-center">{formatDuration(r.effective_sec)}</div>
                <div>
                  <span className={`text-xs px-2 py-1 rounded-md border text-center ${statusStyle(r.status)}`}>{r.status || "—"}</span>
                </div>
                <div className="text-sm text-slate-700 text-center">{r.due_at ? new Date(r.due_at).toLocaleDateString() : "–"}</div>
                <div className={`gap-1 rounded-md border px-2 py-1 text-xs text-center ${priorityClass(r.priority)}`}>
                    {priorityLabel(r.priority)}
                </div>
              </div>
            ))}
            {!loading && items.length === 0 && <div className="p-8 text-center text-slate-500">No tasks</div>}
          </div>

          {/* Pagination (meta left · controls right) */}
          <div className="mt-4">
            <div className="mx-auto w-full">
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {/* Meta (left) */}
                  <div className="text-sm text-slate-500">
                    {data.totalCount} items
                  </div>

                  {/* Controls (right) */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {/* Prev */}
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-9 rounded-full px-3 text-slate-700 disabled:opacity-40"
                    >
                      ‹
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-2">
                      {pageNumbers.map((n, idx) =>
                        n === "…" ? (
                          <span key={`e-${idx}`} className="px-2 text-slate-400 select-none">…</span>
                        ) : (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            className={[
                              "min-w-[36px] rounded-full px-3 text-sm transition",
                              n === page
                                ? "border border-indigo-300 bg-indigo-100/80 text-indigo-700"
                                : "text-slate-800 hover:bg-slate-50 border border-transparent"
                            ].join(" ")}
                            aria-current={n === page ? "page" : undefined}
                          >
                            {n}
                          </button>
                        )
                      )}
                    </div>

                    {/* Next */}
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={page >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      className="h-9 rounded-full px-3 text-slate-700 disabled:opacity-40"
                    >
                      ›
                    </button>

                    <div className="mx-1 h-6 w-px bg-slate-200" />

                    {/* Go to page */}
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <span>Go to</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={String(page)}
                        value={gotoVal}
                        onChange={(e) => setGotoVal(e.target.value.replace(/\D+/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const n = clamp(parseInt(gotoVal || "0", 10) || page, 1, pageCount);
                            setPage(n);
                            setGotoVal("");
                          }
                        }}
                        onBlur={() => {
                          if (!gotoVal) return;
                          const n = clamp(parseInt(gotoVal || "0", 10) || page, 1, pageCount);
                          setPage(n);
                          setGotoVal("");
                        }}
                        className="w-10 rounded-full border border-indigo-300 bg-white px-3 text-center outline-none"
                      />
                      <span>Page</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Sticky totals card */}
      </div>
      <div className="sticky bottom-0 z-20">
        <div className="rounded-2xl mt-3 bg-white/90 backdrop-blur shadow-sm">
          <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              Totals for current filters & period
            </div>
            <div className="flex justify-end gap-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#10b981" }} />
                <div className="text-sm">
                  <div className="font-medium text-slate-800">Total Worked</div>
                  <div className="text-slate-600">{formatDuration(totalWorkedSec)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                <div className="text-sm">
                  <div className="font-medium text-slate-800">Total Paused</div>
                  <div className="text-slate-600">{formatDuration(totalPausedSec)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusStyle(s) {
  if (!s) return "bg-slate-50 border-slate-200 text-slate-700";
  const v = String(s).toLowerCase();
  if (v.includes("progress")) return "bg-orange-50 border-orange-200 text-orange-700";
  if (v.includes("done")) return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (v.includes("todo")) return "bg-blue-50 border-blue-200 text-blue-700";
  return "bg-slate-50 border-slate-200 text-slate-700";
}

function HeaderCell({ label, sortKey, sort, dir, onSort, align="left" }) {
  const isActive = sort === sortKey;
  const justify = align === "center" ? "justify-center text-center" : "justify-start";
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`group flex items-center gap-1 text-left ${justify} ${isActive ? "text-slate-900" : "text-slate-500"}`}
      title={`Sort by ${label}`}
    >
      <span>{label}</span>
      {isActive ? (dir === "ASC" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)
                : <ChevronsUpDown size={14} className="opacity-60 group-hover:opacity-100" />}
    </button>
  );
}
