// src/ui/HoverTitle.jsx
import React, { useRef, useState, useEffect, useRef as useReactRef } from "react";
import { createPortal } from "react-dom";

// Reusable hover popover
function HoverPopover({ anchorEl, open, onEnter, onLeave, children }) {
  if (!open || !anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const pad = 12;
  const bodyX = window.scrollX || document.documentElement.scrollLeft;
  const bodyY = window.scrollY || document.documentElement.scrollTop;

  const preferAbove = rect.top > 120;
  const maxWidth = 420;
  const top = (preferAbove ? rect.top : rect.bottom) + bodyY + (preferAbove ? -8 : 8);
  let left = rect.left + bodyX + Math.min(rect.width, maxWidth) / 2 - maxWidth / 2;
  left = Math.max(pad, Math.min(left, bodyX + window.innerWidth - maxWidth - pad));

  return createPortal(
    <div
      role="tooltip"
      className="rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 pointer-events-auto"
      style={{ position: "absolute", top, left, width: maxWidth, zIndex: 60 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="p-3 text-sm text-slate-800">{children}</div>
    </div>,
    document.body
  );
}

// Full reusable title with hover popover
export default function HoverTitle({ title, subtitle }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const openTimer = useReactRef(null);
  const closeTimer = useReactRef(null);

  const scheduleOpen = () => {
    clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setOpen(true), 120);
  };
  const scheduleClose = () => {
    clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };
  const keepAlive = () => clearTimeout(closeTimer.current);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onEsc, { passive: true });
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <>
      <div
        ref={ref}
        className="font-medium truncate cursor-help"
        title={title}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
        tabIndex={0}
      >
        {title}
      </div>

      <HoverPopover anchorEl={ref.current} open={open} onEnter={keepAlive} onLeave={scheduleClose}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-slate-900 break-words">{title || "Untitled"}</div>
            {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(title || "");
              } catch {}
            }}
            className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            aria-label="Copy title"
          >
            Copy
          </button>
        </div>
      </HoverPopover>
    </>
  );
}
