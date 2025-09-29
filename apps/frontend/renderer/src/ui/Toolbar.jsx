// ui/Toolbar.jsx
import React from "react";
import { Filter, Tag as TagIcon, ChevronDown } from "lucide-react";

// Export so views can reuse/customize if needed
export const STATUS_OPTIONS = [
  { key: "all",         label: "All" },
  { key: "todo",        label: "To-Do" },
  { key: "in progress", label: "In Progress" },
  { key: "done",        label: "Done" },
];

const cx = (...c) => c.filter(Boolean).join(" ");

/**
 * Reusable Toolbar (legacy prop API for compatibility with TodoView)
 *
 * Props (all controlled):
 * - query, setQuery
 * - status, setStatus                 // "all" | "todo" | "in progress" | "done"
 * - project, setProject               // project id or ""
 * - tag, setTag
 * - sort, setSort                     // e.g. "priority-desc", "eta-asc", "title-desc", "due_at-asc"
 * - counts?                           // { todo, "in progress", done }
 * - projects?                         // [{ id, name }]  -> shows project picker if provided
 * - statusOptions?                    // override status pills list
 * - className?
 */
export default function Toolbar({
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
  counts = {},
  projects = [],
  statusOptions = STATUS_OPTIONS,
  className,
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2 rounded-2xl border border-platinum bg-white/70 p-3", className)}>
      {/* Status pills */}
      <div className="flex items-center gap-1">
        {statusOptions.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus?.(s.key)}
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

      {/* Divider */}
      <span className="mx-1 hidden h-5 w-px bg-platinum sm:inline-block" />

      {/* Project (shown only if projects provided) */}
      {projects?.length > 0 && (
        <label className="inline-flex items-center gap-2 text-xs">
          <Filter size={14} className="opacity-70" />
          <span>Project</span>
          <div className="relative">
            <select
              value={project ?? ""}
              onChange={(e) => setProject?.(e.target.value)}
              className="rounded-lg border border-platinum bg-white px-2 py-1 text-xs pr-6"
            >
              <option value="">All</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 top-1.5 size-3 opacity-60" />
          </div>
        </label>
      )}

      {/* Tag */}
      <label className="inline-flex items-center gap-2 text-xs">
        <TagIcon size={14} className="opacity-70" />
        <span>Tag</span>
        <input
          value={tag ?? ""}
          onChange={(e) => setTag?.(e.target.value)}
          placeholder="e.g. ui"
          className="w-28 rounded-lg border border-platinum bg-white px-2 py-1 text-xs"
        />
      </label>

      {/* Sort */}
      <label className="ml-auto inline-flex items-center gap-2 text-xs">
        <span>Sort</span>
        <select
          value={sort ?? "priority-desc"}
          onChange={(e) => setSort?.(e.target.value)}
          className="rounded-lg border border-platinum bg-white px-2 py-1 text-xs"
        >
          <option value="priority-desc">Priority ↓</option>
          <option value="priority-asc">Priority ↑</option>
          <option value="eta-asc">ETA ↑</option>
          <option value="eta-desc">ETA ↓</option>
          <option value="title-asc">Title A–Z</option>
          <option value="title-desc">Title Z–A</option>
          <option value="due_at-asc">Due Date ↑</option>
          <option value="due_at-desc">Due Date ↓</option>
        </select>
      </label>

      {/* Search */}
      <input
        value={query ?? ""}
        onChange={(e) => setQuery?.(e.target.value)}
        placeholder="Search tasks…"
        className="w-full rounded-xl border border-platinum bg-white px-3 py-1.5 text-sm sm:w-64"
      />
    </div>
  );
}
