import React, { useMemo, useState } from "react";
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
} from "lucide-react";

// ------- Mock data (UI only) -------
const projects = [
  { id: "p1", name: "Personal", color: "#fca311" },
  { id: "p2", name: "Client A", color: "#3366FF" },
  { id: "p3", name: "Open Source", color: "#36b37e" },
];

const initialTasks = [
  { id: "t1", title: "Wire up Today view", description: "", projectId: "p3", tags: ["ui", "today"], priority: 1, etaMin: 45, status: "in_progress" },
  { id: "t2", title: "Design TaskCard component", description: "", projectId: "p3", tags: ["component"], priority: 2, etaMin: 90, status: "todo" },
  { id: "t3", title: "Pomodoro widget layout", description: "", projectId: "p1", tags: ["focus"], priority: 1, etaMin: 30, status: "todo" },
  { id: "t4", title: "Kanban DnD stubs", description: "", projectId: "p2", tags: ["kanban"], priority: 0, etaMin: 60, status: "in_progress" },
  { id: "t5", title: "Daily report mock", description: "", projectId: "p2", tags: ["reports"], priority: 0, etaMin: 40, status: "done" },
];

// ------- Small helpers -------
const cx = (...c) => c.filter(Boolean).join(" ");
const getProject = (id) => projects.find(p => p.id === id);
const PRIORITY_LABEL = { 2: "High", 1: "Med", 0: "Low" };
const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "todo", label: "To-Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function PriorityDot({ p }) {
  const map = { 0: "bg-gray-300", 1: "bg-accent", 2: "bg-red-500" };
  return <span className={cx("inline-block size-2 rounded-full", map[p])} />;
}

// ------- Subcomponents -------
function QuickAdd({ onAdd }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        onAdd(t);
        setText("");
      }}
      className="flex items-center gap-2 rounded-2xl border border-platinum bg-white px-3 py-2 shadow-sm"
    >
      <Plus className="opacity-70" size={18} />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quick add task…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
      <button className="rounded-xl bg-brand px-3 py-1 text-sm text-white">Add</button>
    </form>
  );
}

function Toolbar({
  query, setQuery,
  status, setStatus,
  project, setProject,
  tag, setTag,
  sort, setSort,
  counts,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-platinum bg-white/70 p-3">
      {/* Status pills */}
      <div className="flex items-center gap-1">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={cx(
              "rounded-full px-3 py-1 text-xs",
              status === s.key ? "bg-oxford-blue text-white" : "bg-platinum text-oxford-blue/80 hover:bg-platinum/80"
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
            onChange={e => setProject(e.target.value)}
            className="rounded-lg border border-platinum bg-white px-2 py-1 text-xs pr-6"
          >
            <option value="">All</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
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
          onChange={e => setTag(e.target.value)}
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

function TaskRow({ task, selected, onToggleSelected, onToggleDone, onPick }) {
  const proj = getProject(task.projectId);
  const done = task.status === "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "group grid items-center gap-3 rounded-xl border border-platinum bg-white px-3 py-2 shadow-sm",
        "grid-cols-[auto_1fr_auto_auto_auto]"
      )}
      onClick={(e) => {
        const tag = e.target.tagName.toLowerCase();
        if(tag === "input" || tag === "button" || e.target.closest("button")) return;
        onPick?.(task);
      }}
    >
      <input
        aria-label={`Select ${task.title}`}
        type="checkbox"
        checked={selected}
        onChange={onToggleSelected}
        className="size-4 accent-brand"
      />

      <div className="min-w-0">
        <div className={cx("truncate font-medium", done && "line-through text-gray-400")}>
          {task.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
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
                {task.tags.map(t => (
                  <span key={t} className="rounded-full bg-platinum px-2 py-0.5 text-[10px]">#{t}</span>
                ))}
              </span>
            </span>
          )}
        </div>
      </div>

      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
        <Clock3 size={14} /> {task.etaMin ?? "—"}m
      </span>

      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
        <Flag size={14} /><PriorityDot p={task.priority} /> {PRIORITY_LABEL[task.priority] ?? "—"}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
        className={cx(
          "ml-2 inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs",
          done
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : "border-platinum bg-white hover:bg-platinum/60"
        )}
      >
        {done ? <CheckCircle2 size={16} /> : <Circle size={16} />} {done ? "Done" : "Mark done"}
      </button>
    </motion.div>
  );
}

// ------- Main View -------
export default function TodoView({onPickTask}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("priority-desc");

  const counts = useMemo(() => ({
    todo: tasks.filter(t => t.status === "todo").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
  }), [tasks]);

  const visible = useMemo(() => {
    let list = tasks.slice();

    // Filter: status
    if (status !== "all") list = list.filter(t => t.status === status);
    // Filter: project
    if (project) list = list.filter(t => t.projectId === project);
    // Filter: tag (simple contains)
    if (tag.trim()) {
      const needle = tag.trim().toLowerCase();
      list = list.filter(t => (t.tags || []).some(x => x.toLowerCase().includes(needle)));
    }
    // Filter: query (title only for now)
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q));
    }

    // Sort
    const [key, dir] = sort.split("-");
    list.sort((a, b) => {
      let av, bv;
      switch (key) {
        case "priority": av = a.priority ?? -1; bv = b.priority ?? -1; break;
        case "eta": av = a.etaMin ?? 9999; bv = b.etaMin ?? 9999; break;
        case "title": av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [tasks, status, project, tag, query, sort]);

  const allVisibleIds = useMemo(() => new Set(visible.map(t => t.id)), [visible]);

  function handleAdd(text) {
    const id = `t${Date.now().toString(36)}`;
    setTasks(prev => [
      { id, title: text, description: "", projectId: "", tags: [], priority: 0, etaMin: 15, status: "todo" },
      ...prev,
    ]);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function toggleDone(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t));
  }

  function bulkMarkDone() {
    setTasks(prev => prev.map(t => selected.has(t.id) ? { ...t, status: "done" } : t));
    clearSelection();
  }

  function bulkDelete() {
    setTasks(prev => prev.filter(t => !selected.has(t.id)));
    clearSelection();
  }

  const anySelectedVisible = [...selected].some(id => allVisibleIds.has(id));
  const allVisibleSelected = visible.length > 0 && visible.every(t => selected.has(t.id));

  function toggleSelectAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visible.forEach(t => next.delete(t.id));
      } else {
        visible.forEach(t => next.add(t.id));
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
          query={query} setQuery={setQuery}
          status={status} setStatus={setStatus}
          project={project} setProject={setProject}
          tag={tag} setTag={setTag}
          sort={sort} setSort={setSort}
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
          <span>{visible.length} task{visible.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* List */}
      <div className="mt-2 grid gap-2 [grid-template-columns:1fr]">
        {visible.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-platinum bg-white/70 p-6 text-center text-sm text-gray-600">
            No tasks match your filters.
          </div>
        ) : (
          visible.map(t => (
            <TaskRow
              key={t.id}
              task={t}
              selected={selected.has(t.id)}
              onToggleSelected={() => toggleSelect(t.id)}
              onToggleDone={() => toggleDone(t.id)}
              onPick={onPickTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
