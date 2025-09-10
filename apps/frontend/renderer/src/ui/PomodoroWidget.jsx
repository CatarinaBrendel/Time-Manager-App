export default function PomodoroWidget() {
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState("focus"); // "focus" | "break"
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const sessionsCompleted = 2; // mock

  const time = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-platinum bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <AlarmClock size={18} className="text-brand" />
        <div className="font-semibold">Pomodoro</div>
        <span
          className={cx(
            "ml-auto rounded-full px-2 py-0.5 text-xs",
            mode === "focus" ? "bg-accent/10 text-accent" : "bg-platinum"
          )}
        >
          {mode === "focus" ? "Focus" : "Break"}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-4xl font-bold tracking-tight text-brand">{time}</div>
        <span className="text-xs text-gray-500">(mock)</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={cx(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-white",
            running ? "bg-red-500" : "bg-brand"
          )}
          onClick={() => setRunning(!running)}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          className="flex items-center gap-2 rounded-xl bg-gray-200 px-3 py-2"
          onClick={() => setMode(mode === "focus" ? "break" : "focus")}
        >
          <Square size={16} />
          Toggle Mode
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          Sessions: <strong>{sessionsCompleted}</strong>
        </span>
        <span>Focus: 25m • Break: 5m</span>
      </div>
    </div>
  );
}