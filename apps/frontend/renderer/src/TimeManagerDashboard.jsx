// TimeManagerDashboard.jsx
import React from "react";
import DetailsPanel from "./ui/DetailsPanel";
import ComingSoon from "./views/ComingSoon";

// When you implement a view, import it and add it to ROUTE_COMPONENTS
// import RealTodoView from "./views/TodoView";
// const ROUTE_COMPONENTS = { todo: RealTodoView };
const ROUTE_COMPONENTS = {}; // none implemented yet

const ROUTE_TITLES = {
  dashboard: "Dashboard",
  todo: "To-Do",
  reports: "Reports",
  pomodoro: "Pomodoro",
  settings: "Settings",
};

function ViewSwitcher({ route }) {
  const Comp = ROUTE_COMPONENTS[route];
  if (Comp) return <Comp />;
  const title = ROUTE_TITLES[route] ?? "Unknown";
  return <ComingSoon title={`${title} — Coming Soon`} />;
}

export default function TimeManagerDashboard({ activeView }) {
  const route = (activeView || "dashboard").toLowerCase();

  return (
    <div className="h-full w-full min-w-0 bg-platinum/40 text-oxford-blue">
      <div className="grid h-full min-h-0 grid-cols-[1fr_minmax(36px,auto)] gap-4 p-4 transition-[gap] duration-200">
        {/* Main content (only vertical scroller) */}
        <section className="min-w-0 max-w-full overflow-y-auto overflow-x-hidden">
          <ViewSwitcher route={route} />
        </section>

        {/* Collapsible Details expanding left, rail pinned right */}
        <DetailsPanel
          className="hidden lg:block"
          title="Details"
          defaultExpanded={true}
          expandedWidth={320}
          railWidth={36}
        >
          <div className="mb-2 font-semibold">Details</div>
          <p className="text-sm text-gray-600">
            This panel shows context details, timers, or notes. Click the vertical “Details”
            tab to collapse.
          </p>
        </DetailsPanel>
      </div>
    </div>
  );
}
