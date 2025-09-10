// apps/frontend/renderer/src/components/HeaderSearch.jsx
import { useEffect, useRef } from "react";

export default function HeaderSearch({ placeholder = "Search…", onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in inputs
      const tag = document.activeElement?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable;
      if (!typing && e.key === "/") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-100 rounded-xl border border-black/10 bg-white/80 px-3 text-sm outline-none transition focus:border-black/20 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/25"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-black/10 px-1 text-[10px] text-black/60 dark:border-white/15 dark:text-white/60">/</kbd>
    </div>
  );
}
