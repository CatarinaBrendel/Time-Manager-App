// views/ReportsView.jsx
import React, { useEffect, useMemo, useState, useReducer } from "react";
import { reportsAPI } from "../lib/reportsAPI";
import { projectsAPI } from "../lib/projectsAPI";
import Toolbar, { STATUS_OPTIONS as DEFAULT_STATUS_OPTIONS } from "../ui/Toolbar";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatDuration } from "../helpers/helpersFunctions";
import PaginationBar from "../ui/PaginationBar";
import HoverTitle from "../ui/HoverTitle";

/* ------------------------- utilities ------------------------- */
function useDebounced(value, delay = 250) {
  const [v, dispatch] = useReducer((_, x) => x, value);
  useEffect(() => { const id = setTimeout(() => dispatch(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

const initial = { period: "daily", query: "", sortKey: "due_at", dir: "ASC", page: 1, status: "all", project: "", tag: "", priority: "" };
function reducer(state, action) {
  if (action.type === "patch") return { ...state, ...action.patch };
  if (action.type === "patchReset") return { ...state, ...action.patch, page: 1 };
  return state;
}
// Toolbar keys -> DB columns
const mapSortKey = (k) => (k === "priority" ? "effective_sec" : k === "eta" ? "due_at" : k);

// For a small label only (backend handles filtering)
function periodRange(period) {
  const now = new Date();
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const som = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const soy = (d) => new Date(d.getFullYear(), 0, 1);

  let from = null, to = null, label = "All time";
  switch (period) {
    case "daily":   from = sod(now); to = new Date(from); to.setDate(to.getDate() + 1);
                    label = new Intl.DateTimeFormat(undefined,{ dateStyle:"full"}).format(now); break;
    case "monthly": from = som(now); to = new Date(now.getFullYear(), now.getMonth()+1, 1);
                    label = new Intl.DateTimeFormat(undefined,{ month:"long", year:"numeric"}).format(now); break;
    case "yearly":  from = soy(now); to = new Date(now.getFullYear()+1, 0, 1);
                    label = String(now.getFullYear()); break;
    default:        /* all */
  }
  return { fromISO: from?.toISOString(), toISO: to?.toISOString(), label };
}

/* --------------------- tiny presentational ------------------- */
const Loading = () => <div className="p-8 text-center text-slate-500">Loading…</div>;
const Empty   = ({ msg="No tasks" }) => <div className="p-8 text-center text-slate-500">{msg}</div>;

function PeriodBar({ period, onChange }) {
  const opts = [{k:"daily",label:"Daily"},{k:"monthly",label:"Monthly"},{k:"yearly",label:"Yearly"},{k:"all",label:"All"}];
  return (
    <>
      <div className="mx-auto max-w-6xl mt-2 mb-1 rounded-xl border border-platinum bg-white p-1 shadow-sm">
        <div className="inline-flex items-center gap-1">
          {opts.map(o=>(
            <button key={o.k}
              onClick={()=>onChange(o.k)}
              className={"px-3 py-1.5 text-sm rounded-lg "+(period===o.k?"bg-oxford-blue text-white":"text-oxford-blue/80 hover:bg-platinum/60")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-6xl mb-2 text-xs text-slate-500">{periodRange(period).label}</div>
    </>
  );
}

function Row({ r, dateFmt, statusStyle, priorityClass, priorityLabel}) {
  return (
    <div className="grid grid-cols-[1.6fr_0.6fr_0.4fr_0.8fr_0.4fr] px-5 py-2 items-center border-b border-slate-200 last:border-b-0">
      <div className="min-w-0"><HoverTitle title={r.title} subtitle={r.project ? `Project: ${r.project}` : undefined} /></div>
      <div className="text-sm text-slate-700 text-center">{formatDuration(r.effective_sec)}</div>
      <div><span className={`text-xs px-2 py-1 rounded-md border text-center ${statusStyle(r.status)}`}>{r.status || "—"}</span></div>
      <div className="text-sm text-slate-700 text-center">{r.due_at ? dateFmt.format(new Date(r.due_at)) : "–"}</div>
      <div className={`gap-1 rounded-md border px-2 py-1 text-xs text-center ${priorityClass(r.priority)}`}>{priorityLabel(r.priority)}</div>
    </div>
  );
}

/* --------------------------- main ---------------------------- */
export default function ReportsView() {
  const [params, dispatch] = useReducer(reducer, initial);
  const { period, query, sortKey, dir, page, status, project, tag, priority } = params;
  const setAndReset = (patch) => dispatch({ type: "patchReset", patch });
  const setPage = (p) => dispatch({ type: "patch", patch: { page: typeof p === "function" ? p(page) : p } });

  const pageSize = 10;
  const queryDeb = useDebounced(query, 250);

  const [data, setData] = useState({ rows: [], totalCount: 0, page: 1, pageSize, totals: { total_worked_sec: 0, total_paused_sec: 0 } });
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const NO_PROJECT = "__none__";

  useEffect(() => { (async () => {
      try { const rows = await projectsAPI.list(); setProjects(Array.isArray(rows) ? rows : []); }
      catch { setProjects([]); }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await reportsAPI.list({
          period, page, pageSize, sort: sortKey, dir,
          filters: {
            title: queryDeb,
            status: status === "all" ? "" : status,
            projectId: project && project !== NO_PROJECT ? project : undefined,
            noProject: project === NO_PROJECT ? true : undefined,
            tag: tag || undefined,
            priority: priority || undefined,
          }
        });
        if (!cancelled) setData(res);
      } catch (err) {
        console.error("reports.list failed", err);
        if (!cancelled) setData((d) => ({ ...d, rows: [], totalCount: 0 }));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [period, page, pageSize, sortKey, dir, queryDeb, status, project, tag, priority]);

  const items = useMemo(() => data?.rows ?? [], [data]);
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(undefined,{ day:"2-digit", month:"numeric", year:"numeric" }), []);
  const sortValue = `${sortKey}-${dir.toLowerCase()}`;

  // pagination
  const pageCount = Math.max(1, Math.ceil((data?.totalCount ?? 0) / (pageSize || 10)));

  // tiny helpers
  const priorityLabel = (p) => (p==null ? "—" : (typeof p==="number" ? ({1:"Low",2:"Medium",3:"High",4:"Urgent"}[p] || String(p)) :
                              ((s=>s? s[0].toUpperCase()+s.slice(1):"—")(String(p).trim().toLowerCase()))));
  const priorityClass = (p) => {
    const key = typeof p === "number" ? p : ({low:1, medium:2, high:3, urgent:4}[String(p).toLowerCase()] ?? 0);
    return key===1?"border-slate-300 text-slate-700":
           key===2?"border-amber-300 text-amber-700":
           key===3?"border-orange-300 text-orange-700":
           key===4?"border-red-300 text-red-700":"border-slate-200 text-slate-500";
  };

  const counts = useMemo(() => {
    const c = { todo: 0, "in progress": 0, done: 0 };
    for (const r of items) { const s = (r.status || "").toLowerCase(); if (s in c) c[s]++; }
    return c;
  }, [items]);

  const totalWorkedSec = Number(data?.totals?.total_worked_sec ?? 0) || items.reduce((s,r)=>s+(+r.effective_sec||0),0);

  return (
    <div className="flex h-full min-h-0 w-full flex-col text-slate-900 overflow-hidden">
      <div className="shrink-0">
        <PeriodBar
          period={period}
          onChange={(k)=> setAndReset({ period: k, sortKey: "due_at", dir: "ASC" })}
        />
        <div className="mx-auto max-w-6xl pb-2">
          <div className="rounded-2xl bg-white shadow-sm">
            <Toolbar
              query={query} setQuery={(q)=>setAndReset({ query:q })}
              status={status} setStatus={(s)=>setAndReset({ status:s })}
              project={project} setProject={(p)=>setAndReset({ project:p })}
              tag={tag} setTag={(t)=>setAndReset({ tag:t })}
              sort={sortValue}
              setSort={(v)=>{ const [key, direction]=String(v).split("-"); setAndReset({ sortKey: mapSortKey(key), dir: (direction||"asc").toUpperCase() }); }}
              counts={counts} projects={projects} statusOptions={DEFAULT_STATUS_OPTIONS}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-auto rounded-2xl bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1.6fr_0.6fr_0.4fr_0.8fr_0.4fr] px-5 py-2 text-sm font-medium text-slate-500 border-b border-slate-200 sticky top-0 bg-white">
              <HeaderCell label="Title" sortKey="title" sort={sortKey} dir={dir} align="left"
                onSort={(k)=>setAndReset({ sortKey:k, dir: sortKey===k && dir==="ASC" ? "DESC":"ASC" })} />
              <HeaderCell label="Worked" sortKey="effective_sec" sort={sortKey} dir={dir} align="center"
                onSort={(k)=>setAndReset({ sortKey:k, dir: sortKey===k && dir==="ASC" ? "DESC":"ASC" })} />
              <HeaderCell label="Status" sortKey="status" sort={sortKey} dir={dir} align="center"
                onSort={(k)=>setAndReset({ sortKey:k, dir: sortKey===k && dir==="ASC" ? "DESC":"ASC" })} />
              <HeaderCell label="Due Date" sortKey="due_at" sort={sortKey} dir={dir} align="center"
                onSort={(k)=>setAndReset({ sortKey:k, dir: sortKey===k && dir==="ASC" ? "DESC":"ASC" })} />
              <HeaderCell label="Priority" sortKey="priority" sort={sortKey} dir={dir} align="center"
                onSort={(k)=>setAndReset({ sortKey:k, dir: sortKey===k && dir==="ASC" ? "DESC":"ASC" })} />
            </div>

            {loading ? <Loading/> :
             items.length === 0 ? <Empty/> :
             items.map((r)=>(
              <Row key={r.id}
                   r={r}
                   dateFmt={dateFmt}
                   statusStyle={statusStyle}
                   priorityClass={priorityClass}
                   priorityLabel={priorityLabel}
              />
            ))}
          </div>

          {/* Pagination */}
          <PaginationBar
            totalCount={data.totalCount}
            page={page}
            pageCount={pageCount}
            onChange={(p) => setPage(p)}
          />
        </div>
      </div>

      {/* Totals */}
      <div className="sticky bottom-0 z-20">
        <div className="rounded-2xl mt-3 bg-white/90 backdrop-blur shadow-sm">
          <div className="flex flex-col gap-2 px-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">Totals for current filters & period</div>
            <div className="flex justify-end gap-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#10b981" }} />
                <div className="text-sm">
                  <div className="font-medium text-slate-800">Total Worked</div>
                  <div className="text-slate-600">{formatDuration(totalWorkedSec)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- styles & minor UI ---------------------- */
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
    <button onClick={()=>onSort(sortKey)} className={`group flex items-center gap-1 text-left ${justify} ${isActive ? "text-slate-900" : "text-slate-500"}`} title={`Sort by ${label}`}>
      <span>{label}</span>
      {isActive ? (dir === "ASC" ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ChevronsUpDown size={14} className="opacity-60 group-hover:opacity-100" />}
    </button>
  );
}
