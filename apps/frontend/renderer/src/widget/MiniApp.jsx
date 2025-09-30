// reuse your main API + same DB
import "../../input.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { tasksAPI } from "../lib/taskAPI"; 

const cx = (...a) => a.filter(Boolean).join(" ");
const PRIORITY_LABEL = (p) => (p == null ? "-" : String(p));
const STATUS_META = {
  todo:  { text: "To-Do",  bg: "bg-rose-100",  dot: "bg-rose-500",  textColor: "text-rose-800" },
  doing: { text: "In Pro", bg: "bg-slate-200", dot: "bg-slate-500", textColor: "text-slate-800" },
  info:  { text: "Inform", bg: "bg-amber-100", dot: "bg-amber-500", textColor: "text-amber-900" },
};
const normalizeStatus = (s) => (String(s||"").toLowerCase().startsWith("in") ? "doing"
  : String(s||"").toLowerCase().startsWith("inf") ? "info" : "todo");

function LoupeIcon(props){return(<svg viewBox="0 0 24 24" width="18" height="18" {...props}>
  <path fill="currentColor" d="M10 4a6 6 0 104.472 10.09l3.72 3.719a1 1 0 001.415-1.415l-3.72-3.72A6 6 0 0010 4zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"/>
</svg>);}
function ChevronR(props){return(<svg viewBox="0 0 24 24" width="18" height="18" {...props}>
  <path fill="currentColor" d="M9 6l6 6-6 6z"/>
</svg>);}

function StatusPill({ status }) {
  const key = normalizeStatus(status);
  const meta = STATUS_META[key] || STATUS_META.todo;
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", meta.bg, meta.textColor)}>
      <span className={cx("w-2 h-2 rounded-full", meta.dot)} />
      {meta.text}
    </span>
  );
}
function RightMeta({ priority, urgency }) {
  return (
    <div className="flex items-center gap-3 text-slate-500">
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold">P</span>
        <span className="text-xs">{PRIORITY_LABEL(priority)}</span>
      </div>
      <span className="text-xs">{urgency || ""}</span>
      <ChevronR className="text-slate-400" />
    </div>
  );
}

function TaskRow({ task, onStart, onPause, onStop }) {
  const status = task.status || (task.done ? "done" : "todo");
  return (
    <li className="px-3">
      <div className="flex items-start justify-between py-3">
        <div className="flex items-start gap-3 min-w-0">
          <StatusPill status={status} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-slate-800 truncate">{task.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {task.worked_minutes
                ? <>Worked: {Math.round(task.worked_minutes)}min/h</>
                : <>ETA: {task.eta_minutes ? `${Math.round(task.eta_minutes)}min` : "—"}</>}
            </div>
            <div className="mt-1 flex gap-2">
              <button className="text-[11px] text-slate-500 hover:text-slate-700" onClick={() => onStart(task.id)}>Start</button>
              <button className="text-[11px] text-slate-500 hover:text-slate-700" onClick={() => onPause(task.id)}>Pause</button>
              <button className="text-[11px] text-slate-500 hover:text-slate-700" onClick={() => onStop(task.id)}>Stop</button>
            </div>
          </div>
        </div>
        <RightMeta priority={task.priority} urgency={task.urgency_label} />
      </div>
      <div className="h-px bg-slate-200" />
    </li>
  );
}

function QuickAdd({ onAdd }) {
  const [value, setValue] = useState("");
  const submit = useCallback(async (e) => {
    e?.preventDefault();
    const t = value.trim();
    if (!t) return;
    await onAdd(t);
    setValue("");
  }, [value, onAdd]);
  return (
    <form onSubmit={submit} className="flex items-center gap-3 px-3 py-3">
      <div className="relative flex-1">
        <LoupeIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={value}
          onChange={(e)=>setValue(e.target.value)}
          placeholder="Quick add task..."
          className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 outline-none
                     bg-white/90 focus:bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]
                     focus:ring-2 focus:ring-slate-200 text-[14px]"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold
                   shadow-sm hover:bg-slate-800 active:bg-slate-900"
      >
        Add
      </button>
    </form>
  );
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const canIPC = !!(window.tm?.tasks); // present if preload exposed it

  const refresh = useCallback(async () => {
    if (!canIPC) return;
    setLoading(true);
    try {
      // ask the *central* list endpoint for "active today"
      const res = await tasksAPI.list({
        scope: "activeToday",          // <- see backend change in step 2
        limit: 20,
        order: "priority_desc_eta_asc" // hint; backend can ignore if it already enforces
      });
      setTasks(Array.isArray(res) ? res : (res?.items ?? []));
    } finally {
      setLoading(false);
    }
  }, [canIPC]);

  const onAdd = useCallback(async (title) => {
    if (!canIPC) return;
    // your central quick-create; should accept just { title }
    await tasksAPI.create({ title });
    await refresh();
  }, [canIPC, refresh]);

  const onStart = useCallback((id)=> tasksAPI.start(id), []);
  const onPause = useCallback((id)=> tasksAPI.pause(id), []);
  const onStop  = useCallback((id)=> tasksAPI.stop(id),  []);

  useEffect(() => { refresh(); }, [refresh]);

  const sorted = useMemo(() => {
    // safety net—backend should already order
    return [...tasks].sort((a,b)=>{
      const pa = a.priority ?? -1, pb = b.priority ?? -1;
      if (pb !== pa) return pb - pa;
      const ea = a.eta_minutes ?? 1e9, eb = b.eta_minutes ?? 1e9;
      return ea - eb;
    });
  }, [tasks]);

  return (
    <div className="p-2">
      <div
        className="w-[360px] bg-white/95 backdrop-blur rounded-[22px] border border-slate-200
                   shadow-[0_20px_50px_-20px_rgba(2,6,23,0.25)]
                   overflow-hidden select-none"
      >
        {!canIPC && (
          <div className="px-3 pt-2 text-[11px] text-rose-600">
            Running outside Electron (window.tm.tasks missing). UI preview only.
          </div>
        )}
        <QuickAdd onAdd={onAdd} />
        <div className="h-px bg-slate-200" />
        {loading && <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>}
        <ul className="py-1">
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} onStart={onStart} onPause={onPause} onStop={onStop} />
          ))}
          {sorted.length === 0 && !loading && (
            <li className="px-3 py-4 text-sm text-slate-500">No active tasks due today.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
