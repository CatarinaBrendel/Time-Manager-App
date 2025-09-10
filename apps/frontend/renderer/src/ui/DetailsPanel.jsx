import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function cx(...c) { return c.filter(Boolean).join(" "); }

export default function DetailsPanel({
  title = "Details",
  defaultExpanded = true,
  expandedWidth = 320,
  railWidth = 36,
  className = "",
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const width = expanded ? expandedWidth : railWidth;

  return (
    <motion.aside
      // Keep right edge fixed; left edge moves
      animate={{ width }}
      initial={false}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      style={{ willChange: "width", transformOrigin: "right center" }}
      className={cx(
        "relative min-h-0 overflow-hidden rounded-2xl border border-platinum bg-white/60 justify-self-end",
        className
      )}
      aria-label={`${title} panel`}
    >
      {/* Vertical rail on RIGHT (the toggle) */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-controls="details-content"
        title={expanded ? `Collapse ${title}` : `Expand ${title}`}
        className={cx(
          "absolute right-0 top-0 h-full",
          "flex items-center justify-center",
          "border-l border-platinum/70 bg-white/80 hover:bg-white",
          "text-xs font-semibold tracking-wider text-oxford-blue/80 hover:text-oxford-blue",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        )}
        style={{
          width: railWidth,
          writingMode: "vertical-rl",
        }}
      >
        {title}
      </button>

      {/* Content reveals from the rail → left */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="details-content"
            key="panel-content"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18 }}
            className="h-full min-h-0 overflow-y-auto p-4"
            style={{ marginRight: railWidth }}
          >
            {children ?? (
              <div className="text-sm text-gray-600">
                Nothing selected yet. This panel will show task details, timers, or notes.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
