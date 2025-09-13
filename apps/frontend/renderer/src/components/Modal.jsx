// apps/frontend/renderer/src/ui/TaskModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { tagsAPI } from "../lib/taskAPI";

// ---- ChipInput stays the same as in your current modal ----
function ChipInput({ label, placeholder, mode = "multi", value, onChange, suggestions = [] }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [popIndex, setPopIndex] = useState(-1);
  const inputRef = useRef(null);

  const chips = useMemo(
    () => (mode === "single" ? (value ? [value] : []) : Array.isArray(value) ? value : []),
    [mode, value]
  );

  const selectedLower = useMemo(
    () => new Set(chips.map((c) => c.toLowerCase())),
    [chips]
  );

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    let pool = (suggestions || [])
      .map(String)
      .filter((name) => !selectedLower.has(name.toLowerCase()));
    if (q) pool = pool.filter((name) => name.toLowerCase().includes(q));
    return pool.slice(0, 8);
  }, [suggestions, selectedLower, input]);

  const commit = (t) => {
    const s = String(t || "").trim();
    if (!s) return;
    if (mode === "single") {
      if (!chips.includes(s)) onChange(s);
    } else {
      if (!chips.some((c) => c.toLowerCase() === s.toLowerCase())) {
        onChange([...chips, s]);
        // pop effect on the newly added chip
        setPopIndex(chips.length);
        setTimeout(() => setPopIndex(-1), 250);
      }
    }
    setInput("");
    setActiveIndex(-1);
    setOpen(false);
  };

  const removeAt = (i) => {
    if (mode === "single") onChange("");
    else onChange(chips.filter((_, j) => j !== i));
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) commit(filtered[activeIndex]);
      else commit(input); // create new tag
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Backspace" && !input && chips.length) {
      removeAt(chips.length - 1);
    }
  };

  return (
    <div className="w-full">
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}

      <div
        className="relative"
        onMouseDown={() => inputRef.current?.focus()}
      >
        <div className="flex min-h-[42px] w-full flex-wrap gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
          {chips.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className={`inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 transition-transform ${
                popIndex === i ? "scale-105 ring-2 ring-indigo-200" : ""
              }`}
            >
              {c}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="rounded-full p-0.5 text-indigo-500 hover:bg-indigo-100"
                aria-label={`Remove ${c}`}
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          ))}

          {!(mode === "single" && chips.length === 1) && (
            <input
              ref={inputRef}
              value={input}
              onFocus={() => setOpen(true)}
              onChange={(e) => { setInput(e.target.value); setOpen(true); setActiveIndex(-1); }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="min-w-[120px] flex-1 border-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
          )}
        </div>

        {/* Dropdown */}
        {open && (filtered.length > 0 || input.trim()) && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {filtered.map((name, idx) => (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(name)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                  idx === activeIndex ? "bg-indigo-50" : ""
                }`}
              >
                <span>{name}</span>
                <span className="text-xs text-gray-400">press ⏎</span>
              </button>
            ))}

            {/* Create new */}
            {input.trim() &&
              !filtered.some((s) => s.toLowerCase() === input.trim().toLowerCase()) && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(input)}
                  className="flex w-full items-center justify-between border-t border-gray-100 px-3 py-2 text-left text-sm hover:bg-green-50"
                >
                  <span>Create “{input.trim()}”</span>
                  <span className="text-xs text-gray-400">press ⏎</span>
                </button>
              )}
          </div>
        )}
      </div>

      <p className="mt-1 text-xs text-gray-400">
        {mode === "single"
          ? "Type a project and press Enter."
          : "Type to search or create. Enter to add. ↑/↓ to navigate."}
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
  const [allTags, setAllTags] = useState([]);      // [{id,name}]
  const [etaMin, setEtaMin] = useState(
    Number.isFinite(safeInitial.eta_sec) ? Math.round(safeInitial.eta_sec / 60) : ""
  );

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
    setEtaMin(
      Number.isFinite(si.eta_sec)
        ? Math.round(Number(si.eta_sec) / 60)
        : Number.isFinite(si.etaMin)
          ? Math.round(Number(si.etaMin))
          : ""
    );
  }, [open, initial, today]);

  // lock background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // tags
  useEffect(() => {
    (async () => {
      try {
        const rows = await tagsAPI.list();
        setAllTags(rows || []);
      } catch { /* ignore */ }
    })();
  }, []);

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
    eta_sec: (etaMin === "" || etaMin == null ? null : Math.max(0, parseInt(etaMin, 10)) * 60),
  };

  const ui = (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/40">
      <div className="w-full max-w-2xl max-h-[min(100vh-1.5rem)] overflow-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-2">
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
            <textarea 
              rows={2} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm
                  leading-5 resize-y overflow-y-auto max-h-28 min-h-[3.25rem] focus:outline-none focus:ring-2 focus:ring-indigo-500
                  whitespace-pre-wrap break-words" />
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
            <ChipInput
              label="Tags"
              placeholder="Type to search or create…"
              mode="multi"
              value={tags}
              onChange={setTags}
              suggestions={(allTags || []).map((t) => t.name)}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* ETA (minutes) */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">ETA (minutes)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={5}
                  inputMode="numeric"
                  placeholder="e.g. 25"
                  value={etaMin}
                  onChange={(e) => {
                    const v = e.target.value;
                    // allow blank, otherwise keep 0+ integers
                    if (v === "") return setEtaMin("");
                    const n = Math.max(0, Math.floor(Number(v) || 0));
                    setEtaMin(n);
                  }}
                  className="w-32 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-1">
                  {[5, 15, 25, 60].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setEtaMin(n)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      {n}m
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Used for planning; the actual total comes from tracked work time (excludes pauses).
              </p>
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
