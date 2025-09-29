// TimeManagerDashboard.jsx
import React, { useCallback, useState } from "react";
import DetailsPanel from "./ui/DetailsPanel";
import ComingSoon from "./views/ComingSoon";
import TodoView from "./views/TodoView";
import PomodoroWidget from "./ui/PomodoroWidget";
import TaskDetailsCard from "./ui/TaskDetailsCard";
import ReportsView from "./views/ReportsView";

// When a view is implemented, import it and add it to ROUTE_COMPONENTS
// import RealTodoView from "./views/TodoView";
// const ROUTE_COMPONENTS = { todo: RealTodoView };
const ROUTE_COMPONENTS = {
  tasks: TodoView,
  reports: ReportsView,
}; // none implemented yet

const ROUTE_TITLES = {
  dashboard: "Dashboard",
  tasks: "Tasks",
  reports: "Reports",
  pomodoro: "Pomodoro",
  settings: "Settings",
};

export default function TimeManagerDashboard({ activeView }) {
  const route = (activeView || "dashboard").toLowerCase();

  const [currentTask, setCurrentTask] = useState(null);
  const handlePickTask = useCallback((task) => setCurrentTask(task), []);

  const Comp = ROUTE_COMPONENTS[route];
  const title = ROUTE_TITLES[route] ?? "Unknown";

  return (
    <div className="h-full w-full min-w-0 bg-platinum/40 text-oxford-blue">
      <div className="grid h-full min-h-0 grid-cols-[1fr_minmax(36px,auto)] gap-4 p-4 transition-[gap] duration-200">
        {/* Main content (only vertical scroller) */}
        <section className="min-w-0 max-w-full overflow-y-auto overflow-x-hidden">
          {Comp
            ? <Comp onPickTask={handlePickTask} />
            : <ComingSoon title={`${title} — Coming Soon`} />}
        </section>

        {/* Collapsible Details expanding left, rail pinned right */}
        <DetailsPanel
          className="hidden lg:block"
          title="Details"
          defaultExpanded={true}
          expandedWidth={320}
          railWidth={36}
        >
          {/* Make two stacked areas; bottom can scroll if tall */}
          <div className="flex h-full min-h-0 flex-col gap-4">
            <PomodoroWidget />
            <div className="min-h-0 flex-1 overflow-auto">
              <TaskDetailsCard task={currentTask} />
            </div>
          </div>
        </DetailsPanel>
      </div>
    </div>
  );
}
