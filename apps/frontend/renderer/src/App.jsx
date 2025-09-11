// apps/frontend/renderer/src/App.jsx
import { useMemo, useState, useEffect } from "react";
import Sidebar, { defaultSidebarItems, defaultFooterItems } from "./components/Sidebar";
import StickyHeader from "./components/StickyHeader";
import HeaderSearch from "./components/HeaderSearch";
import { Plus, Play, User } from "lucide-react";
import TimeManagerDashboard from "./TimeManagerDashboard";

// Small hook to keep "today" fresh (updates at next midnight)
function useWeekday() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tickToMidnight = () => {
      const n = new Date();
      const next = new Date(n);
      next.setHours(24, 0, 0, 0); // next midnight
      return next.getTime() - n.getTime();
    };
    const t = setTimeout(() => {
      setNow(new Date());
      // after first midnight tick, keep a daily tick
      const daily = setInterval(() => setNow(new Date()), 24 * 60 * 60 * 1000);
      return () => clearInterval(daily);
    }, tickToMidnight());
    return () => clearTimeout(t);
  }, []);
  const weekdayShort = useMemo(
    () => now.toLocaleDateString(undefined, { weekday: "short" }),
    [now]
  );
  const weekdayLong = useMemo(
    () => now.toLocaleDateString(undefined, { weekday: "long" }),
    [now]
  );
  return { weekdayShort, weekdayLong };
}

export default function App() {
  const [active, setActive] = useState("dashboard");
  const { weekdayLong } = useWeekday();

  useEffect(() => {
    const sync = () => {
      const key = (location.hash.replace("#/", "") || "dashboard").toLowerCase();
      setActive(key);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const items = useMemo(() => defaultSidebarItems, []);
  const footerItems = useMemo(() => defaultFooterItems, []);

  // Central place to define route metadata (title + optional tagline)
  const routeMeta = useMemo(() => {
    const map = {
      dashboard: { title: "Dashboard", tagline: "Focus Sprint" },
      tasks: { title: "Tasks", tagline: "Track & Triage" },
      pomodoro: { title: "Pomodoro", tagline: "Sprint, Pause, Achieve" },
      reports: { title: "Reports", tagline: "Insights" },
      settings: { title: "Settings", tagline: "Preferences" },
    };

    // Fallback: try to read the label from the sidebar for unknown keys
    if (!map[active]) {
      const fromSidebar = items.find((i) => i.key?.toLowerCase() === active);
      return {
        title: fromSidebar?.label || active.charAt(0).toUpperCase() + active.slice(1),
        tagline: undefined,
      };
    }
    return map[active];
  }, [active, items]);

  // Keep browser tab title in sync
  useEffect(() => {
    document.title = `${routeMeta.title} · ${weekdayLong} · Time Manager`;
  }, [routeMeta.title, weekdayLong]);

  return (
    <div className="h-screen w-screen bg-platinum text-oxford-blue">
      {/* Grid with 2 columns: sidebar (auto) + main (1fr) */}
      <div className="grid h-full grid-cols-[auto_1fr]">
        <Sidebar
          items={items}
          footerItems={footerItems}
          activeKey={active}
          onNavigate={setActive}
          defaultCollapsed={false}   // your 96px collapsed width is fine
          persistKey="tm.sidebar.collapsed"
        />

        {/* Right column is another grid: header (auto) + content (1fr) */}
        <div className="grid min-w-0 grid-rows-[auto_1fr] h-full isolate">
          {/* Sticky header INSIDE the main column; spans full right column width */}
          <StickyHeader
            height={64}
            left={
              <div className="flex items-center gap-3">
                <h1 className="truncate text-base font-semibold">{routeMeta.title}</h1>
                <span className="hidden text-xs text-black/60 sm:inline dark:text-white/60">
                  {weekdayLong}
                  {routeMeta.tagline ? ` · ${routeMeta.tagline}` : ""}
                </span>
              </div>
            }
            right={
              <>
                <HeaderSearch />
                <button className="h-9 rounded-xl border border-black/10 bg-white/80 px-3 text-sm hover:bg-white dark:border-white/15 dark:bg-white/10">
                  <span className="inline-flex items-center gap-2">
                    <Plus className="size-4" /> New Task
                  </span>
                </button>
              </>
            }
          />

          {/* Scrollable content row */}
          <main className="min-w-0 overflow-auto">
            <TimeManagerDashboard activeView={active} />
          </main>
        </div>
      </div>
    </div>
  );
}
