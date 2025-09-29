import React from "react";
import { ArrowUpRight, Clock, CheckCircle2, AlertTriangle, CalendarDays, Target, Flame } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

/**
 * DashboardViewMock
 * - No live data; everything here is mocked to demonstrate layout and UX.
 * - Meant to complement an existing Details Sidebar that already contains the Pomodoro widget.
 * - Focuses on metrics (day/week/month), summaries, and quick actions — not a second timer.
 */
export default function DashboardView() {
  // --- Mock Data ---
  const today = {
    dateLabel: new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    tasksDue: 3,
    tasksCompleted: 5,
    tasksOverdue: 1,
    focusSessions: 6, // completed today
    focusMinutes: 150, // effective
    pausedMinutes: 24,
    streakDays: 4,
  };

  const upcoming = [
    { id: 1, title: "Finish onboarding doc", due: "Today 17:00", project: "Internal", priority: "High" },
    { id: 2, title: "Prep sprint report", due: "Tomorrow 10:00", project: "Client A", priority: "Medium" },
    { id: 3, title: "Debug internal solution", due: "Wednesday 09:00", project: "Client A", priority: "Low" },
    { id: 4, title: "Prep product presentation", due: "Today 11:00", project: "Client A", priority: "Urgent" },
    { id: 5, title: "Review sprint report", due: "Tomorrow 14:00", project: "Client A", priority: "Medium" },
  ];

  const activity = [
    { id: "a1", time: "09:34", text: "Marked 'Create Reports window' as Done" },
    { id: "a2", time: "10:12", text: "Logged 25 min focus on 'Dashboard polish'" },
    { id: "a3", time: "13:15", text: "Logged 45 min focus on 'Dashboard polish'" },
    { id: "a4", time: "16:00", text: "Finished last week report" },
  ];

  return (
    <div className="px-3 py-2 space-y-3 max-h-[900px] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-slate-500 mt-0.5">{today.dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm hover:bg-slate-800 flex items-center gap-1">
            View Reports <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Focus (min)" value={today.focusMinutes} hint="Today" trend="up" />
        <StatCard icon={CheckCircle2} label="Tasks Completed" value={today.tasksCompleted} hint="Today" trend="up" />
        <StatCard icon={AlertTriangle} label="Overdue" value={today.tasksOverdue} hint="Needs attention" trend="flat" />
        <StatCard icon={Flame} label="Streak" value={`${today.streakDays} days`} hint="Keep it going" trend="up" />
      </div>
      {/* Bottom Row: Upcoming Deadlines + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Upcoming Deadlines">
          <ul className="divide-y divide-slate-100">
            {upcoming.map((u) => (
              <li key={u.id} className="py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{u.title}</div>
                  <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {u.due}</span>
                    <span>•</span>
                    <span>{u.project}</span>
                  </div>
                </div>
                <span className={badgeClass(u.priority)}>{u.priority}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recent Activity" footer={<button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 w-full">View All</button>}>
          <ul className="divide-y divide-slate-100">
            {activity.map((a) => (
              <li key={a.id} className="py-3 flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-slate-400 mt-2" />
                <div>
                  <div className="text-sm text-slate-800">{a.text}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{a.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ===== UI Primitives =====
function Card({ title, children, footer }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {title ? (
        <div className="px-4 pt-4 pb-2 border-b border-slate-100">
          <h3 className="font-medium text-slate-900">{title}</h3>
        </div>
      ) : null}
      <div className="p-4">{children}</div>
      {footer ? <div className="px-4 py-2 border-t border-slate-100">{footer}</div> : null}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, hint, trend = "flat" }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
      <div>
        <div className="text-slate-500 text-sm">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{hint}</div>
      </div>
      <div className={`shrink-0 rounded-xl p-3 ${trendBg(trend)}`}>
        <Icon className="text-slate-700" size={20} />
      </div>
    </div>
  );
}

function trendBg(t) {
  switch (t) {
    case "up":
      return "bg-emerald-50 border border-emerald-100";
    case "down":
      return "bg-red-50 border border-red-100";
    default:
      return "bg-slate-50 border border-slate-100";
  }
}

function Tabs({ tabs, children }) {
  const [active, setActive] = React.useState(0);
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActive(i)}
            className={`px-3 py-1.5 rounded-lg border text-sm ${
              active === i
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div>{Array.isArray(children) ? children[active] : children}</div>
    </div>
  );
}

function ProgressRow({ label, value, max }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900 font-medium">{value}/{max}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
        <div className="h-2 bg-slate-900 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function badgeClass(priority) {
  switch ((priority || "").toLowerCase()) {
    case "urgent":
      return "px-2 py-0.5 text-xs rounded-md bg-red-50 text-red-700 border border-red-200";
    case "high":
      return "px-2 py-0.5 text-xs rounded-md bg-orange-50 text-orange-700 border border-orange-200";
    case "medium":
      return "px-2 py-0.5 text-xs rounded-md bg-amber-50 text-amber-700 border border-amber-200";
    default:
      return "px-2 py-0.5 text-xs rounded-md bg-slate-50 text-slate-700 border border-slate-200";
  }
}
