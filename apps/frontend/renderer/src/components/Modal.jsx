// apps/frontend/renderer/src/ui/TaskModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// ---- ChipInput stays the same as in your current modal ----
function ChipInput({ label, placeholder, mode = "multi", value, onChange }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const chips = useMemo(
    () => (mode === "single" ? (value ? [value] : []) : Array.isArray(value) ? value : []),
    [mode, value]
  );
  const commit = (t) => {
    const s = t.trim(); if (!s) return;
    if (mode === "single") onChange(s);
    else if (!chips.includes(s)) onChange([...chips, s]);
    setInput("");
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(input); }
    else if (e.key === "Backspace" && !input && chips.length) onChange(mode === "single" ? "" : chips.slice(0, -1));
  };
  return (
    <div className="w-full">
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <div
        className="flex min-h-[42px] w-full flex-wrap gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((c, i) => (
          <span key={`${c}-${i}`} className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
            {c}
            <button type="button" onClick={() => (mode === "single" ? onChange("") : onChange(chips.filter((_, j) => j !== i)))} className="rounded-full p-0.5 text-indigo-500 hover:bg-indigo-100">
              <X className="h-4 w-4" />
            </button>
          </span>
        ))}
        {!(mode === "single" && chips.length === 1) && (
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="min-w-[120px] flex-1 border-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {mode === "single" ? "Type a project and press Enter." : "Type a tag and press Enter or comma."}
      </p>
    </div>
  );
}

export function Modal({ open, mode = "create", initial = {}, onClose, onSubmit }) {
  const safeInitial = initial ?? {};
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState(safeInitial.title ?? "");
  const [description, setDescription] = useState(safeInitial.description ?? "");
  const [project, setProject] = useState(safeInitial.project ?? "");
  const [priority, setPriority] = useState((safeInitial.priority ?? "low").toLowerCase());
  const [tags, setTags] = useState(Array.isArray(safeInitial.tags) ? safeInitial.tags : []);
  const [due, setDue] = useState(safeInitial.dueDate ?? safeInitial.due_at ?? today);

  // reseed fields each time we open with new initial data
  useEffect(() => {
    if (!open) return;
    const si = initial ?? {};
    setTitle(si.title ?? "");
    setDescription(si.description ?? "");
    setProject(si.project ?? "");
    setPriority((si.priority ?? "low").toLowerCase());
    setTags(Array.isArray(si.tags) ? si.tags : []);
    setDue(si.dueDate ?? si.due_at ?? today);
  }, [open, initial, today]);

  // lock background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const valid = title.trim().length > 0;
  const payload = {
    ...(safeInitial.id ? { id: safeInitial.id } : {}),
    title: title.trim(),
    description: description.trim() || "",
    project: project || null,       // string; your repo can resolve later
    priority,                       // 'low'|'medium'|'high'|'urgent'
    tags,
    dueDate: due || null,           // yyyy-mm-dd
  };

  const ui = (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/40">
      <div className="w-full max-w-2xl max-h-[min(90vh,48rem)] overflow-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold">{mode === "edit" ? "Edit Task" : "Add New Task"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Task Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task name</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description <span className="text-gray-400">(optional)</span></label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Project + Priority */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ChipInput label="Project" placeholder="Type project and Enter" mode="single" value={project} onChange={setProject} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Tags + Due Date */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ChipInput label="Tags" placeholder="Type tag and Enter" mode="multi" value={tags} onChange={setTags} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {/* Status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <p 
              className={`rounded-xl border px-3 py-2 text-sm font-medium
                ${
                  safeInitial.status === "in progress"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : safeInitial.status === "done"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
                >
              {safeInitial.status
                ? safeInitial.status.charAt(0).toUpperCase() + safeInitial.status.slice(1)
                : "To-Do"}
                
            </p>
         </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-platinum">Cancel</button>
          <button
            onClick={() => onSubmit?.(payload)}
            disabled={!valid}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === "edit" ? "Save Changes" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
