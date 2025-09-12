import React, { createContext, useCallback, useContext, useState } from "react";
import { X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((msg, type = "info", timeout = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, msg, type }]);
    if (timeout > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, timeout);
    }
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ add }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              flex items-center gap-2 rounded-lg px-3 py-2 shadow-lg text-sm text-white
              ${t.type === "success" ? "bg-emerald-600" : ""}
              ${t.type === "error" ? "bg-red-600" : ""}
              ${t.type === "warning" ? "bg-amber-600" : ""}
              ${t.type === "info" ? "bg-brand" : ""}
            `}
          >
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => remove(t.id)} className="text-white/80 hover:text-white">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
