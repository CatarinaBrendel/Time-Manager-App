// components/PaginationBar.jsx
import React, { useMemo, useState } from "react";

export function makePageNumbers(page, pageCount, delta = 1) {
  const out = [];
  const left = Math.max(1, page - delta);
  const right = Math.min(pageCount, page + delta);
  if (left > 1) out.push(1);
  if (left > 2) out.push("…");
  for (let i = left; i <= right; i++) out.push(i);
  if (right < pageCount - 1) out.push("…");
  if (right < pageCount) out.push(pageCount);
  return out;
}

function GotoPage({ page, pageCount, onChange }) {
  const [val, setVal] = useState("");
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const commit = () => {
    const n = clamp(parseInt(val || "0", 10) || page, 1, pageCount);
    onChange(n);
    setVal("");
  };
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <span>Go to</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={String(page)}
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D+/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onBlur={() => val && commit()}
        className="w-10 rounded-full border border-indigo-300 bg-white px-3 text-center outline-none"
      />
      <span>Page</span>
    </div>
  );
}

/**
 * Props:
 * - totalCount: number (shown on the left)
 * - page: number (1-based)
 * - pageCount: number (>=1)
 * - onChange: (newPage:number) => void
 * - showGoto?: boolean (default true)
 * - className?: string
 */
export default function PaginationBar({
  totalCount,
  page,
  pageCount,
  onChange,
  showGoto = true,
  className = "",
}) {
  const nums = useMemo(() => makePageNumbers(page, pageCount, 1), [page, pageCount]);
  return (
    <div className={`rounded-2xl bg-white px-3 py-2 mt-3 shadow-sm ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Meta (left) */}
        <div className="text-sm text-gray-500">
          {totalCount} items • Page {page} of {pageCount}
        </div>

        {/* Controls (right) */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Prev */}
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onChange(Math.max(1, page - 1))}
            className="h-9 rounded-full px-3 text-gray-700 disabled:opacity-40"
          >
            ‹
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-2">
            {nums.map((n, idx) =>
              n === "…" ? (
                <span key={`e-${idx}`} className="px-2 text-gray-400 select-none">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange(n)}
                  className={[
                    "min-w-[36px] rounded-full px-3 text-sm transition",
                    n === page
                      ? "border border-indigo-300 bg-indigo-100/80 text-indigo-700"
                      : "text-gray-800 hover:bg-gray-50 border border-transparent",
                  ].join(" ")}
                  aria-current={n === page ? "page" : undefined}
                >
                  {n}
                </button>
              )
            )}
          </div>

          {/* Next */}
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onChange(Math.min(pageCount, page + 1))}
            className="h-9 rounded-full px-3 text-gray-700 disabled:opacity-40"
          >
            ›
          </button>

          {showGoto && (
            <>
              <div className="mx-1 h-6 w-px bg-gray-200" />
              <GotoPage page={page} pageCount={pageCount} onChange={onChange} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
