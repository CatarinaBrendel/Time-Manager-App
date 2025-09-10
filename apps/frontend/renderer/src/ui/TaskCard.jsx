export default function TaskCard({ task }) {
  const proj = projectById(task.projectId);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl border border-platinum bg-white p-3 shadow-sm hover:shadow-md"
    >
      <div className="mb-2 flex items-center gap-2">
        {priorityDot(task.priority)}
        <div className="truncate font-medium">{task.title}</div>
        {task.running && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
            <TimerIcon size={14} />
            live
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {proj && (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: proj.color }} />
            {proj.name}
          </span>
        )}
        {typeof task.etaMin === "number" && (
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} /> {task.etaMin}m ETA
          </span>
        )}
        {task.tags && task.tags.length > 0 && (
          <span className="ml-auto inline-flex max-w-[50%] flex-wrap gap-1">
            {task.tags.map((t) => (
              <span key={t} className="rounded-full bg-platinum px-2 py-0.5 text-[10px]">
                #{t}
              </span>
            ))}
          </span>
        )}
      </div>
    </motion.div>
  );
}