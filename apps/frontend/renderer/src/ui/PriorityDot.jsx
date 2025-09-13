const cx = (...c) => c.filter(Boolean).join(" ");
export function PriorityDot({ p }) {
  const map = { 0: "bg-gray-300", 1: "bg-accent", 2: "bg-red-500", 3:"bg-black" };
  return <span className={cx("inline-block size-2 rounded-full", map[p])} />;
}
