export default function KanbanColumn({ title, count, children }) {
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