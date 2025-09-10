import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Filter,
  ChevronDown,
  Clock3,
  Tag as TagIcon,
  Flag,
  CheckCircle2,
  Circle,
  Trash2
} from "lucide-react";
import { tasksAPI } from "../lib/taskAPI";

// ------- Mock projects (UI only) -------
const projects = [
  { id: "p1", name: "Personal", color: "#fca311" },
  { id: "p2", name: "Client A", color: "#3366FF" },
  { id: "p3", name: "Open Source", color: "#36b37e" },
];

const cx = (...c) => c.filter(Boolean).join(" ");
const getProject = (id) => projects.find((p) => p.id === id);
const PRIORITY_LABEL = { 2: "High", 1: "Med", 0: "Low" };
const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "todo", label: "To-Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

// ---- DB <-> UI status mapping ----
const dbToUiStatus = (s) => (s === "doing" ? "in_progress" : s)|| "todo";
const uiToDbStatus = (s) => (s === "in_progress" ? "doing" : s);

// Fill UI-only fields for DB tasks
function hydrateTask(dbTask = {}) {
  // Accept tags from various shapes: array | stringified JSON | null/undefined
  let raw = dbTask.tags ?? dbTask.tags_json ?? [];
  let tags;
  if (Array.isArray(raw)) {
    tags = raw;
  } else if (typeof raw === "string") {
    try { tags = JSON.parse(raw); } catch { tags = []; }
  } else {
    tags = [];
  }

  return {
    id: dbTask.id,
    title: dbTask.title || "",
    description: dbTask.description ?? "",
    status: dbToUiStatus(dbTask.status),
    tags,                              // always an array
    due_at: dbTask.due_at ?? null,
    created_at: dbTask.created_at || "",
    updated_at: dbTask.updated_at || "",

    // UI-only placeholders (until schema supports them)
    projectId: "",
    priority: 0,
    etaMin: 15,
  };
}


function PriorityDot({ p }) {
  const map = { 0: "bg-gray-300", 1: "bg-accent", 2: "bg-red-500" };
  return <span className={cx("inline-block size-2 rounded-full", map[p])} />;
}

// ------- Subcomponents -------
function QuickAdd({ onAdd }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || pending) return;
    setPending(true);
    setErr(null);
    try {
      await onAdd(t);        // <-- await the parent handler
      setText("");
    } catch (e) {
      setErr(e?.message || "Failed to add task");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}
      className="flex items-center gap-2 rounded-2xl border border-platinum bg-white px-3 py-2 shadow-sm"
    >
      <Plus className="opacity-70" size={18} />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quick add task…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        disabled={pending}
      />
      <button
        className="rounded-xl bg-brand px-3 py-1 text-sm text-white disabled:opacity-60"
        disabled={pending || !text.trim()}
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
    </form>
  );
}

function Toolbar({
  query,
  setQuery,
  status,
  setStatus,
  project,
  setProject,
  tag,
  setTag,
  sort,
  setSort,
  counts,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-platinum bg-white/70 p-3">
      {/* Status pills */}
      <div className="flex items-center gap-1">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={cx(
              "rounded-full px-3 py-1 text-xs",
              status === s.key
                ? "bg-oxford-blue text-white"
                : "bg-platinum text-oxford-blue/80 hover:bg-platinum/80"
            )}
          >
            {s.label}
            {s.key !== "all" && (
              <span className="ml-1 rounded-full bg-white/60 px-1 text-[10px] text-oxford-blue/80">
                {counts[s.key] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <span className="mx-1 hidden h-5 w-px bg-platinum sm:inline-block" />

      {/* Project filter */}
      <label className="inline-flex items-center gap-2 text-xs">
        <Filter size={14} className="opacity-70" />
        <span>Project</span>
        <div className="relative">
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="rounded-lg border border-platinum bg-white px-2 py-1 text-xs pr-6"
          >
            <option value="">All</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 top-1.5 size-3 opacity-60" />
        </div>
      </label>

      {/* Tag filter */}
      <label className="inline-flex items-center gap-2 text-xs">
        <TagIcon size={14} className="opacity-70" />
        <span>Tag</span>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. ui"
          className="w-28 rounded-lg border border-platinum bg-white px-2 py-1 text-xs"
        />
      </label>

      {/* Sort */}
      <label className="ml-auto inline-flex items-center gap-2 text-xs">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-platinum bg-white px-2 py-1 text-xs"
        >
          <option value="priority-desc">Priority ↓</option>
          <option value="priority-asc">Priority ↑</option>
          <option value="eta-asc">ETA ↑</option>
          <option value="eta-desc">ETA ↓</option>
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
        </select>
      </label>

      {/* Search */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tasks…"
        className="w-full rounded-xl border border-platinum bg-white px-3 py-1.5 text-sm sm:w-64"
      />
    </div>
  );
}

function TaskRow({ task, selected, onToggleSelected, onToggleDone, onDelete, onPick }) {
  const proj = getProject(task.projectId);
  const done = task.status === "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "group grid items-center gap-3 rounded-xl border border-platinum bg-white px-3 py-2 shadow-sm",
        // ⬇ 3 columns: checkbox | content | actions
        "grid-cols-[auto_1fr_auto]"
      )}
      onClick={(e) => {
        const tag = e.target.tagName.toLowerCase();
        if (tag === "input" || tag === "button" || e.target.closest("button")) return;
        onPick?.(task);
      }}
    >
      {/* Checkbox */}
      <input
        aria-label={`Select ${task.title}`}
        type="checkbox"
        checked={selected}
        onChange={onToggleSelected}
        className="size-4 accent-brand"
      />

      {/* Content: title + second line meta */}
      <div className="min-w-0">
        <div className={cx("truncate font-medium text-oxford-blue", done && "line-through text-gray-400")}>
          {task.title}
        </div>

        {/* second line: project/tag/time/priority */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {proj && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: proj.color }} />
              {proj.name}
            </span>
          )}

          {task.tags?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <TagIcon size={14} />
              <span className="flex flex-wrap gap-1">
                {task.tags.map((t) => (
                  <span key={t} className="rounded-full bg-platinum px-2 py-0.5 text-[10px]">#{t}</span>
                ))}
              </span>
            </span>
          )}

          {/* time */}
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} /> {task.etaMin ?? "—"}m
          </span>

          {/* priority */}
          <span className="inline-flex items-center gap-1">
            <Flag size={14} />
            <PriorityDot p={task.priority} /> {PRIORITY_LABEL[task.priority] ?? "—"}
          </span>
        </div>
      </div>

      {/* Actions: Mark done + Trash */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
          className={cx(
            "inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs",
            done
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-platinum bg-white hover:bg-platinum/60"
          )}
        >
          {done ? <CheckCircle2 size={16} /> : <Circle size={16} />} {done ? "Done" : "Mark done"}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          title="Delete task"
          aria-label={`Delete ${task.title}`}
          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 hover:border-red-300"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}


// ------- Main View -------
export default function TodoView({ onPickTask }) {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("priority-desc");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await tasksAPI.list({ limit: 200, offset: 0 });
      setTasks(rows.map(hydrateTask));
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd(text) {
    const created = await tasksAPI.create({ title: text, description: "", due_at: null, tags: [] });

    try {
      if (created && typeof created === 'object' && created.id) {
        setTasks(prev => [hydrateTask(created), ...prev]);
      } else if (Number.isFinite(created)) {
        // backend returned just an ID
        const row = await tasksAPI.get(created);
        setTasks(prev => [hydrateTask(row), ...prev]);
      } else {
        // as a last resort, refresh
        await refresh();
      }
    } catch(error) {
      console.err(error);
      setErr(e?.message || "Failed to add a new task");
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function toggleDone(id) {
    try {
      const t = tasks.find((x) => x.id === id);
      if (!t) return;
      const nextStatus = t.status === "done" ? "todo" : "done";
      const updated = await tasksAPI.update({ id, status: uiToDbStatus(nextStatus) });
      setTasks((prev) =>
        prev.map((x) => (x.id === id ? hydrateTask(updated) : x))
      );
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to update task");
    }
  }

  async function bulkMarkDone() {
    try {
      const ids = [...selected];
      await Promise.all(
        ids.map((id) => {
          const t = tasks.find((x) => x.id === id);
          if (!t) return null;
          if (t.status === "done") return null;
          return tasksAPI.update({ id, status: "done" });
        })
      );
      await refresh();
      clearSelection();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to bulk update");
    }
  }

  async function handleDelete(id) {
  try {
    await tasksAPI.delete(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  } catch (e) {
    console.error("Delete failed:", e);
    setErr(e?.message || "Failed to delete task");
  }
}


  async function bulkDelete() {
    try {
      const ids = [...selected];
      await Promise.all(ids.map((id) => tasksAPI.delete(id)));
      setTasks((prev) => prev.filter((t) => !selected.has(t.id)));
      clearSelection();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to delete all slected tasks");
    }
  }

  const counts = useMemo(
    () => ({
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    }),
    [tasks]
  );

  const visible = useMemo(() => {
    let list = tasks.slice();

    if (status !== "all") list = list.filter((t) => t.status === status);
    if (project) list = list.filter((t) => t.projectId === project);

    if (tag.trim()) {
      const needle = tag.trim().toLowerCase();
      list = list.filter((t) => (t.tags || []).some((x) => x.toLowerCase().includes(needle)));
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }

    const [key, dir] = sort.split("-");
    list.sort((a, b) => {
      let av, bv;
      switch (key) {
        case "priority":
          av = a.priority ?? -1;
          bv = b.priority ?? -1;
          break;
        case "eta":
          av = a.etaMin ?? 9999;
          bv = b.etaMin ?? 9999;
          break;
        case "title":
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [tasks, status, project, tag, query, sort]);

  const allVisibleIds = useMemo(() => new Set(visible.map((t) => t.id)), [visible]);
  const anySelectedVisible = [...selected].some((id) => allVisibleIds.has(id));
  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visible.forEach((t) => next.delete(t.id));
      } else {
        visible.forEach((t) => next.add(t.id));
      }
      return next;
    });
  }

  return (
    <div className="min-w-0 max-w-full">
      {/* Quick Add */}
      <QuickAdd onAdd={handleAdd} />

      {/* Toolbar */}
      <div className="mt-3">
        <Toolbar
          query={query}
          setQuery={setQuery}
          status={status}
          setStatus={setStatus}
          project={project}
          setProject={setProject}
          tag={tag}
          setTag={setTag}
          sort={sort}
          setSort={setSort}
          counts={counts}
        />
      </div>

      {/* Bulk bar */}
      {anySelectedVisible && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div>{selected.size} selected</div>
          <div className="flex items-center gap-2">
            <button onClick={bulkMarkDone} className="rounded-lg bg-amber-900/10 px-3 py-1 hover:bg-amber-900/15">
              Mark done
            </button>
            <button onClick={bulkDelete} className="rounded-lg bg-amber-900/10 px-3 py-1 hover:bg-amber-900/15">
              Delete
            </button>
            <button onClick={clearSelection} className="rounded-lg bg-amber-900/10 px-3 py-1 hover:bg-amber-900/15">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* List header */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <input
            aria-label="Select all visible"
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            className="size-4 accent-brand"
          />
          <span>
            {visible.length} task{visible.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="mt-2 grid gap-2 [grid-template-columns:1fr]">
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-platinum bg-white/70 p-6">
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-platinum bg-white/70 p-6 text-center text-sm text-gray-600">
            {err ? err : "No tasks match your filters."}
          </div>
        ) : (
          visible.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              selected={selected.has(t.id)}
              onToggleSelected={() => toggleSelect(t.id)}
              onToggleDone={() => toggleDone(t.id)}
              onDelete={handleDelete}
              onPick={onPickTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
