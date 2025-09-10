import React, { useMemo, useState } from "react";
import {
  Play,
  Pause,
  Square,
  Plus,
  Timer as TimerIcon,
  CalendarDays,
  KanbanSquare,
  ListTodo,
  BarChart3,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Clock3,
  AlarmClock,
} from "lucide-react";
import { motion } from "framer-motion";

// --------------------------------------------------
// Mock Data (UI-only)
// --------------------------------------------------

const projects = [
  { id: "p1", name: "Personal", color: "#fca311" },
  { id: "p2", name: "Client A", color: "#3366FF" },
  { id: "p3", name: "Open Source", color: "#36b37e" },
];

const initialTasks = [
  {
    id: "t1",
    title: "Wire up Today view",
    description: "Quick add, timeline placeholder, totals.",
    projectId: "p3",
    tags: ["ui", "today"],
    priority: 1,
    etaMin: 45,
    status: "in_progress",
    running: true,
  },
  {
    id: "t2",
    title: "Design TaskCard component",
    projectId: "p3",
    tags: ["component"],
    priority: 2,
    etaMin: 90,
    status: "todo",
  },
  {
    id: "t3",
    title: "Pomodoro widget layout",
    projectId: "p1",
    tags: ["focus"],
    priority: 1,
    etaMin: 30,
    status: "todo",
  },
  {
    id: "t4",
    title: "Kanban DnD stubs",
    projectId: "p2",
    tags: ["kanban"],
    priority: 0,
    etaMin: 60,
    status: "in_progress",
  },
  {
    id: "t5",
    title: "Daily report mock",
    projectId: "p2",
    tags: ["reports"],
    priority: 0,
    etaMin: 40,
    status: "done",
  },
];

// --------------------------------------------------
// Utilities
// --------------------------------------------------

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function priorityDot(p) {
  const map = {
    0: "bg-platinum",
    1: "bg-accent",
    2: "bg-red-500",
  };
  if (p === undefined || p === null) return null;
  return <span className={cx("inline-block h-2 w-2 rounded-full", map[p])} />;
}

function projectById(id) {
  return projects.find((p) => p.id === id);
}

// --------------------------------------------------
// Subcomponents
// --------------------------------------------------

function Sidebar({ collapsed, onToggle, activePath, onNavigate }) {
  const Item = ({ icon, label, path }) => (
    <button
      onClick={() => onNavigate(path)}
      className={cx(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
        activePath === path ? "bg-oxford-blue/10 text-brand" : "hover:bg-platinum/60"
      )}
      title={label}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  return (
    <div
      className={cx(
        "flex h-full flex-col border-r border-platinum/60 bg-white/60 backdrop-blur-sm",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-brand" />
          {!collapsed && <div className="font-semibold">Time Manager</div>}
        </div>
        <button
          onClick={onToggle}
          className="rounded-lg p-1 hover:bg-platinum/60"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="px-2">
        <Item icon={<CalendarDays size={18} />} label="Dashboard" path="/dashboard" />
        <Item icon={<KanbanSquare size={18} />} label="Kanban" path="/kanban" />
        <Item icon={<ListTodo size={18} />} label="Todo" path="/todo" />
        <Item icon={<BarChart3 size={18} />} label="Reports" path="/reports/daily" />
      </div>

      <div className="mt-auto p-2">
        <Item icon={<SettingsIcon size={18} />} label="Settings" path="/settings" />
      </div>
    </div>
  );
}

function QuickAdd() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-platinum bg-white px-3 py-2 shadow-sm">
      <Plus className="opacity-70" size={18} />
      <input
        placeholder="Quick add task (mock)"
        className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
      />
      <button className="rounded-xl bg-brand px-3 py-1 text-sm text-white">Add</button>
    </div>
  );
}

function TaskCard({ task }) {
  const proj = projectById(task.projectId);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl border border-platinum bg-white p-3 shadow-sm hover:shadow-md"
    >
      <div className="mb-2 flex items-center gap-2">
        {priorityDot(task.priority)}
        <div className="truncate font-medium">{task.title}</div>
        {task.running && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
            <TimerIcon size={14} />
            live
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {proj && (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: proj.color }} />
            {proj.name}
          </span>
        )}
        {typeof task.etaMin === "number" && (
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} /> {task.etaMin}m ETA
          </span>
        )}
        {task.tags && task.tags.length > 0 && (
          <span className="ml-auto inline-flex max-w-[50%] flex-wrap gap-1">
            {task.tags.map((t) => (
              <span key={t} className="rounded-full bg-platinum px-2 py-0.5 text-[10px]">
                #{t}
              </span>
            ))}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function KanbanColumn({ title, count, children }) {
  return (
    <div className="flex h-full min-w-[280px] flex-1 flex-col gap-3 rounded-2xl border border-platinum bg-white/70 p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        <span className="rounded-full bg-platinum px-2 py-0.5 text-xs">{count}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function PomodoroWidget() {
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState("focus"); // "focus" | "break"
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const sessionsCompleted = 2; // mock

  const time = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-platinum bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <AlarmClock size={18} className="text-brand" />
        <div className="font-semibold">Pomodoro</div>
        <span
          className={cx(
            "ml-auto rounded-full px-2 py-0.5 text-xs",
            mode === "focus" ? "bg-accent/10 text-accent" : "bg-platinum"
          )}
        >
          {mode === "focus" ? "Focus" : "Break"}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-4xl font-bold tracking-tight text-brand">{time}</div>
        <span className="text-xs text-gray-500">(mock)</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={cx(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-white",
            running ? "bg-red-500" : "bg-brand"
          )}
          onClick={() => setRunning(!running)}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          className="flex items-center gap-2 rounded-xl bg-gray-200 px-3 py-2"
          onClick={() => setMode(mode === "focus" ? "break" : "focus")}
        >
          <Square size={16} />
          Toggle Mode
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          Sessions: <strong>{sessionsCompleted}</strong>
        </span>
        <span>Focus: 25m • Break: 5m</span>
      </div>
    </div>
  );
}

// --------------------------------------------------
// Main Component
// --------------------------------------------------

export default function TimeManagerDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [route, setRoute] = useState("/kanban");
  const [tasks] = useState(initialTasks);

  const grouped = useMemo(() => {
    return {
      todo: tasks.filter((t) => t.status === "todo"),
      in_progress: tasks.filter((t) => t.status === "in_progress"),
      done: tasks.filter((t) => t.status === "done"),
    };
  }, [tasks]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-platinum/40 text-oxford-blue">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-platinum bg-white/80 px-4 py-3 backdrop-blur">
        <TimerIcon className="text-brand" size={18} />
        <div className="font-semibold">Time Manager Dashboard</div>
        <div className="ml-auto w-full max-w-xl">
          <QuickAdd />
        </div>
      </div>

      {/* Content area */}
      <div className="flex h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          activePath={route}
          onNavigate={setRoute}
        />

        {/* Main / Center */}
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4">
          {route.startsWith("/kanban") && (
            <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto">
              <KanbanColumn title="Todo" count={grouped.todo.length}>
                {grouped.todo.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </KanbanColumn>
              <KanbanColumn title="In Progress" count={grouped.in_progress.length}>
                {grouped.in_progress.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </KanbanColumn>
              <KanbanColumn title="Done" count={grouped.done.length}>
                {grouped.done.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </KanbanColumn>
            </div>
          )}

          {route === "/dashboard" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2 rounded-2xl border border-platinum bg-white p-4">
                <div className="mb-2 font-semibold">Today (mock)</div>
                <div className="text-sm text-gray-600">Timeline and totals placeholder.</div>
              </div>
              <PomodoroWidget />
            </div>
          )}

          {route.startsWith("/reports") && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl border border-platinum bg-white p-4">
                <div className="mb-2 font-semibold">Reports (mock)</div>
                <div className="text-sm text-gray-600">Chart container placeholder.</div>
              </div>
              <div className="rounded-2xl border border-platinum bg-white p-4">
                <div className="mb-2 font-semibold">Details</div>
                <div className="text-sm text-gray-600">Table placeholder.</div>
              </div>
            </div>
          )}

          {route === "/todo" && (
            <div className="rounded-2xl border border-platinum bg-white p-4">
              <div className="mb-2 font-semibold">Todo List (mock)</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {initialTasks.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}

          {route === "/settings" && (
            <div className="rounded-2xl border border-platinum bg-white p-4">
              <div className="mb-2 font-semibold">Settings (mock)</div>
              <div className="text-sm text-gray-600">Theme, Pomodoro lengths, backups, etc.</div>
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="hidden w-80 flex-col gap-4 border-l border-platinum bg-white/60 p-4 xl:flex">
          <PomodoroWidget />

          <div className="rounded-2xl border border-platinum bg-white p-4">
            <div className="mb-2 font-semibold">Selected Task</div>
            <div className="text-sm text-gray-600">(mock) Click a task to see details here.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
