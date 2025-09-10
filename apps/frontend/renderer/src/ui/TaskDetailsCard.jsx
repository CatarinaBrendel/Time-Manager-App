import { Clock3, Flag, Tag as TagIcon } from "lucide-react";

function Field({label, children}){
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

export default function TaskDetailsCard({ task }) {
  if (!task) {
    return (
      <div className="rounded-2xl border border-platinum bg-white/70 p-4 text-sm text-gray-600">
        Select a task to see its details here.
      </div>
    );
  }

  const priorityText = task.priority === 2 ? "High" : task.priority === 1 ? "Medium" : "Low";

  return (
    <div className="rounded-2xl border border-platinum bg-white p-4">
      <div className="mb-2 text-base font-semibold">{task.title}</div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ETA">
          <span className="inline-flex items-center gap-1 text-gray-700">
            <Clock3 size={16}/> {task.etaMin ?? "—"} min
          </span>
        </Field>

        <Field label="Priority">
          <span className="inline-flex items-center gap-1 text-gray-700">
            <Flag size={16}/> {priorityText}
          </span>
        </Field>

        <Field label="Tags">
          {task.tags?.length ? (
            <span className="inline-flex flex-wrap items-center gap-1 text-gray-700">
              <TagIcon size={16} className="opacity-70" />
              {task.tags.map(t => (
                <span key={t} className="rounded-full bg-platinum px-2 py-0.5 text-[10px]">#{t}</span>
              ))}
            </span>
          ) : "—"}
        </Field>

        <Field label="Status">
          <span className="rounded-full bg-platinum px-2 py-0.5 text-[12px] text-oxford-blue/80">
            {task.status}
          </span>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Description">
          <p className="text-sm text-gray-700">
            {task.description?.trim() || "(No description yet)"}
          </p>
        </Field>
      </div>
    </div>
  );
}
