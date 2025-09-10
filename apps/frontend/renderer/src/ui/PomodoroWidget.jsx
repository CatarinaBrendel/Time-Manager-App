import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, AlarmClock } from "lucide-react";

function cx(...c){ return c.filter(Boolean).join(" "); }

export default function PomodoroMini({
  initialFocus = 25,
  initialBreak = 5,
}) {
  const [mode, setMode] = useState("focus"); // "focus" | "break"
  const [running, setRunning] = useState(false);
  const [mins, setMins] = useState(initialFocus);
  const [secs, setSecs] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setSecs(s => {
        if (s > 0) return s - 1;
        return 59;
      });
      setMins(m => {
        if (secs > 0) return m;
        if (m > 0) return m - 1;
        // switch mode when reaching 00:00
        const nextMode = mode === "focus" ? "break" : "focus";
        setMode(nextMode);
        return nextMode === "focus" ? initialFocus : initialBreak;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, secs, mode]);

  function toggleRun(){ setRunning(v => !v); }
  function reset(){
    setRunning(false);
    setMode("focus");
    setMins(initialFocus);
    setSecs(0);
  }

  const time = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;

  return (
    <div className="rounded-2xl border border-platinum bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlarmClock className="text-brand" size={18} />
        <div className="font-semibold">Pomodoro</div>
        <span className={cx(
          "ml-auto rounded-full px-2 py-0.5 text-xs",
          mode === "focus" ? "bg-accent/10 text-accent" : "bg-platinum text-oxford-blue/80"
        )}>
          {mode === "focus" ? "Focus" : "Break"}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tracking-tight text-brand">{time}</div>
        <span className="text-[11px] text-gray-500">(mock)</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={toggleRun}
          className={cx("flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-white",
            running ? "bg-red-500" : "bg-brand")}
        >
          {running ? <Pause size={16}/> : <Play size={16}/>}
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-gray-200 px-3 py-1.5 text-sm"
        >
          <RotateCcw size={16}/> Reset
        </button>
      </div>
    </div>
  );
}
