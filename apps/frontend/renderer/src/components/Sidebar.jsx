import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KanbanSquare,
  ListChecks,
  Timer,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * Sidebar
 *
 * Props:
 * - items: Array<{ key: string, label: string, icon: ReactNode, onClick?: () => void, href?: string }>
 * - footerItems: same shape as items (rendered at bottom)
 * - activeKey: string (current active key)
 * - onNavigate: (key: string) => void  (called when an item is clicked)
 * - defaultCollapsed: boolean
 * - persistKey: string (localStorage key to persist collapse state)
 * - className: string (extra classes for root)
 */
export default function Sidebar({
  items = [],
  footerItems = [],
  activeKey,
  onNavigate,
  defaultCollapsed = false,
  persistKey = "tm.sidebar.collapsed",
  className = "",
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Load persisted state on mount
  useEffect(() => {
    const saved = localStorage.getItem(persistKey);
    if (saved !== null) setCollapsed(saved === "1");
  }, [persistKey]);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(persistKey, collapsed ? "1" : "0");
  }, [collapsed, persistKey]);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);

  // Keyboard shortcut: Ctrl/Cmd + B toggles sidebar
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  const width = collapsed ? 75 : 200;
  const containerClasses = "relative z-30 h-full bg-oxford-blue text-white/90 border-r border-white/10 flex flex-col";

  const renderItem = useCallback(
    (item) => {
      const isActive = item.key === activeKey;
      const base =
        "group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors cursor-pointer";
      const active =
        "bg-white/10 text-white hover:bg-white/15";
      const inactive =
        "text-white/80 hover:bg-white/10 hover:text-white";

      const Icon = item.icon;

      const onClick = () => {
        if (item.onClick) item.onClick();
        if (onNavigate) onNavigate(item.key);
        if (item.href) {
          // Optional: basic hash navigation without a router
          if (item.href.startsWith("#")) {
            window.location.hash = item.href;
          } else {
            window.location.assign(item.href);
          }
        }
      };

      return (
        <li key={item.key} className="px-2">
          <button
            onClick={onClick}
            className={`${base} ${isActive ? active : inactive}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="inline-flex size-6 items-center justify-center">
              {Icon ? <Icon className="size-5" aria-hidden /> : null}
            </span>

            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  className="text-sm font-medium"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </li>
      );
    },
    [activeKey, collapsed, onNavigate]
  );

  const headerContent = useMemo(
    () => (
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="ml-2 size-7 rounded-xl bg-white/10 inline-flex items-center justify-center">
            <Timer className="size-4" aria-hidden />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                className="text-sm font-semibold tracking-wide"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
              >
                Time Manager
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={toggle}
          className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title="Toggle sidebar (Ctrl/Cmd+B)"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
    ),
    [collapsed, toggle]
  );

  return (
    <motion.aside
      className={`${containerClasses} ${className}`}
      initial={false}
      animate={{ width }}
      transition={{ type: "spring", stiffness: 250, damping: 30 }}
      aria-label="Main sidebar"
    >
      <div className="h-3" />
      {headerContent}
      <div className="h-3" />

      <nav className="flex-1 overflow-auto">
        <ul className="space-y-1">
          {items.map(renderItem)}
        </ul>
      </nav>

      {footerItems?.length > 0 && (
        <>
          <div className="mt-2 border-t border-white/10" />
          <nav className="py-2">
            <ul className="space-y-1">
              {footerItems.map(renderItem)}
            </ul>
          </nav>
        </>
      )}

      <div className="h-3" />
    </motion.aside>
  );
}

/**
 * Example default items set (optional export for convenience).
 * You can import and customize these in your parent.
 */
export const defaultSidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: KanbanSquare, href: "#/dashboard" },
  { key: "todo", label: "To-Do", icon: ListChecks, href: "#/todo" },
  { key: "pomodoro", label: "Pomodoro", icon: Timer, href: "#/pomodoro" },
  { key: "reports", label: "Reports", icon: BarChart3, href: "#/reports" },
];

export const defaultFooterItems = [
  { key: "settings", label: "Settings", icon: Settings, href: "#/settings" },
];
