import React, { useMemo, useState } from "react";

// Simple pill button used in header
function SegButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-lg border text-sm",
        active
          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// Section wrapper to keep consistent card style
function Card({ title, children, footer }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {title ? (
        <div className="px-4 pt-4 pb-2 border-b border-slate-100">
          <h3 className="font-medium text-slate-900">{title}</h3>
        </div>
      ) : null}
      <div className="p-4 space-y-4">{children}</div>
      {footer ? <div className="px-4 py-3 border-t border-slate-100">{footer}</div> : null}
    </section>
  );
}

// === INDIVIDUAL VIEWS ===
function ViewNotifications({ settings, set }) {
  return (
    <div className="space-y-6">
      <Card title="Notifications & Reminders">
        <RowToggle
          label="Enable desktop notifications"
          checked={settings.notifications.enabled}
          onChange={(v) => set({ notifications: { ...settings.notifications, enabled: v } })}
        />
        <RowSelect
          label="Default reminder"
          value={settings.notifications.defaultLead}
          onChange={(v) => set({ notifications: { ...settings.notifications, defaultLead: v } })}
          options={[
            { value: "0", label: "At due time" },
            { value: "5m", label: "5 minutes before" },
            { value: "10m", label: "10 minutes before" },
            { value: "30m", label: "30 minutes before" },
            { value: "1h", label: "1 hour before" },
          ]}
        />
        <RowToggle
          label="Allow snooze on reminders"
          checked={settings.notifications.allowSnooze}
          onChange={(v) => set({ notifications: { ...settings.notifications, allowSnooze: v } })}
        />
      </Card>
    </div>
  );
}

function ViewTimeReports({ settings, set }) {
  return (
    <div className="space-y-6">
      <Card title="Time & Reports">
        <RowSelect
          label="Default reporting period"
          value={settings.reports.defaultPeriod}
          onChange={(v) => set({ reports: { ...settings.reports, defaultPeriod: v } })}
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "all", label: "All" },
          ]}
        />
        <RowSelect
          label="First day of week"
          value={settings.reports.firstDayOfWeek}
          onChange={(v) => set({ reports: { ...settings.reports, firstDayOfWeek: v } })}
          options={[
            { value: "monday", label: "Monday" },
            { value: "sunday", label: "Sunday" },
          ]}
        />
        <RowSelect
          label="Default table page size"
          value={String(settings.reports.pageSize)}
          onChange={(v) => set({ reports: { ...settings.reports, pageSize: Number(v) } })}
          options={[10, 20, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
        />
        <RowToggle
          label="Show sticky totals card"
          checked={settings.reports.stickyTotals}
          onChange={(v) => set({ reports: { ...settings.reports, stickyTotals: v } })}
        />
        <RowToggle
          label="Show archived tasks in reports by default"
          checked={settings.reports.showArchived}
          onChange={(v) => set({ reports: { ...settings.reports, showArchived: v } })}
        />
      </Card>
    </div>
  );
}

function ViewAppearance({ settings, set }) {
  return (
    <div className="space-y-6">
      <Card title="Appearance & Layout">
        <RowSelect
          label="Theme"
          value={settings.ui.theme}
          onChange={(v) => set({ ui: { ...settings.ui, theme: v } })}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "auto", label: "Auto" },
          ]}
        />
        <RowSelect
          label="Density"
          value={settings.ui.density}
          onChange={(v) => set({ ui: { ...settings.ui, density: v } })}
          options={[
            { value: "relaxed", label: "Relaxed" },
            { value: "compact", label: "Compact" },
          ]}
        />
        <RowToggle
          label="Show Priority column"
          checked={settings.ui.columns.priority}
          onChange={(v) => set({ ui: { ...settings.ui, columns: { ...settings.ui.columns, priority: v } } })}
        />
        <RowToggle
          label="Show Tags column"
          checked={settings.ui.columns.tags}
          onChange={(v) => set({ ui: { ...settings.ui, columns: { ...settings.ui.columns, tags: v } } })}
        />
      </Card>
    </div>
  );
}

function ViewTaskDefaults({ settings, set }) {
  return (
    <div className="space-y-6">
      <Card title="Task & Workflow Defaults">
        <RowSelect
          label="Default status for new tasks"
          value={settings.tasks.defaultStatus}
          onChange={(v) => set({ tasks: { ...settings.tasks, defaultStatus: v } })}
          options={[
            { value: "todo", label: "To-do" },
            { value: "in progress", label: "In Progress" },
            { value: "done", label: "Done" },
          ]}
        />
        <RowSelect
          label="Default priority for new tasks"
          value={settings.tasks.defaultPriority}
          onChange={(v) => set({ tasks: { ...settings.tasks, defaultPriority: v } })}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ]}
        />
        <RowSelect
          label="Auto-archive completed tasks"
          value={String(settings.tasks.autoArchiveDays)}
          onChange={(v) => set({ tasks: { ...settings.tasks, autoArchiveDays: Number(v) } })}
          options={[
            { value: "0", label: "Never" },
            { value: "7", label: "After 7 days" },
            { value: "30", label: "After 30 days" },
            { value: "90", label: "After 90 days" },
          ]}
        />
      </Card>
    </div>
  );
}

function ViewDataPrivacy({ settings, set }) {
  return (
    <div className="space-y-6">
      <Card title="Data & Privacy" footer={
        <div className="flex items-center gap-2 justify-end">
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">Download CSV</button>
          <button className="rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-1.5 text-sm hover:bg-red-100">Clear Local Cache</button>
        </div>
      }>
        <RowStatic label="Local database size" value="12.4 MB (mock)" />
        <RowStatic label="Last export" value="2025-09-28 14:22 (mock)" />
        <RowToggle
          label="Participate in anonymous usage metrics"
          checked={settings.privacy.metrics}
          onChange={(v) => set({ privacy: { ...settings.privacy, metrics: v } })}
        />
      </Card>
    </div>
  );
}

// === SMALL UI PRIMITIVES ===
function Row({ children }) {
  return <div className="flex items-center justify-between gap-4">{children}</div>;
}
function Label({ children }) {
  return <span className="text-slate-700">{children}</span>;
}
function RowToggle({ label, checked, onChange }) {
  return (
    <Row>
      <Label>{label}</Label>
      <input
        type="checkbox"
        className="h-5 w-5 rounded-md border-slate-300"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </Row>
  );
}
function RowSelect({ label, value, onChange, options }) {
  return (
    <Row>
      <Label>{label}</Label>
      <select
        className="border rounded-md px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}
function RowStatic({ label, value }) {
  return (
    <Row>
      <Label>{label}</Label>
      <span className="text-slate-900 font-medium">{value}</span>
    </Row>
  );
}

// === MAIN VIEW WITH HEADER TABS ===
export default function SettingsView() {
  const [active, setActive] = useState("notifications");

  // Fake data (mock settings state)
  const [settings, setSettings] = useState({
    notifications: { enabled: true, defaultLead: "10m", allowSnooze: true },
    reports: { defaultPeriod: "daily", firstDayOfWeek: "monday", pageSize: 10, stickyTotals: true, showArchived: false },
    ui: { theme: "auto", density: "relaxed", columns: { priority: true, tags: true } },
    tasks: { defaultStatus: "todo", defaultPriority: "medium", autoArchiveDays: 7 },
    privacy: { metrics: false },
  });

  const applyPatch = (patch) => setSettings((prev) => ({ ...prev, ...patch }));

  const tabs = useMemo(
    () => [
      { id: "notifications", label: "Notifications" },
      { id: "time", label: "Time & Reports" },
      { id: "appearance", label: "Appearance" },
      { id: "tasks", label: "Task Defaults" },
      { id: "privacy", label: "Data & Privacy" },
    ],
    []
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <div className="flex items-center gap-2 ml-2">
            {tabs.map((t) => (
              <SegButton key={t.id} active={active === t.id} onClick={() => setActive(t.id)}>
                {t.label}
              </SegButton>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" onClick={() => window.alert("Reverted (mock)")}>Reset</button>
          <button className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm hover:bg-slate-800" onClick={() => window.alert("Saved (mock)\n" + JSON.stringify(settings, null, 2))}>Save Changes</button>
        </div>
      </div>

      {/* Body (switch by active tab) */}
      {active === "notifications" && (
        <ViewNotifications settings={settings} set={(v) => applyPatch(v)} />
      )}
      {active === "time" && (
        <ViewTimeReports settings={settings} set={(v) => applyPatch(v)} />
      )}
      {active === "appearance" && (
        <ViewAppearance settings={settings} set={(v) => applyPatch(v)} />
      )}
      {active === "tasks" && (
        <ViewTaskDefaults settings={settings} set={(v) => applyPatch(v)} />
      )}
      {active === "privacy" && (
        <ViewDataPrivacy settings={settings} set={(v) => applyPatch(v)} />
      )}
    </div>
  );
}
