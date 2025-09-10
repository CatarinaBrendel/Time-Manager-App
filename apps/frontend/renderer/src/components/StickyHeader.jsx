import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * StickyHeader
 *
 * Props:
 * - left: ReactNode          content aligned left (title/breadcrumbs)
 * - right: ReactNode         content aligned right (actions/search/user)
 * - height: number           header height in px (default 64)
 * - className: string        extra class names for the header container
 * - blur: boolean            enable backdrop blur (default true)
 * - translucent: boolean     add translucent background (default true)
 *
 * Usage: Place directly inside the page shell ABOVE scrollable content.
 * Remember to add padding-top to the scrollable area equal to `height`.
 */
export default function StickyHeader({
  left,
  right,
  height = 64,
  className = "",
  blur = true,
  translucent = true,
}) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 2);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const bg = translucent ? "bg-white/70 dark:bg-oxford-blue/60" : "bg-white dark:bg-oxford-blue";
  const backdrop = blur ? "backdrop-blur supports-[backdrop-filter]:backdrop-blur" : "";

  return (
    <motion.header
      ref={headerRef}
      role="banner"
      className={`sticky top-0 z-20 w-full border-b border-black/5 dark:border-white/10 ${bg} ${backdrop} ${className}`}
      style={{ height }}
      initial={false}
      animate={{ boxShadow: scrolled ? "0 6px 18px rgba(0,0,0,0.08)" : "0 0 0 rgba(0,0,0,0)" }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
    >
      <div className="flex h-full w-full items-center px-3 sm:px-4">
        <div className="min-w-0 flex-1">{left}</div>
        <div className="ml-3 flex items-center gap-2 sm:gap-3">{right}</div>
      </div>
    </motion.header>
  );
}

/**
 * Helper: StickyHeaderSpacer
 * Place this right under <StickyHeader /> OR at top of your scrollable container
 * to avoid content going under the fixed header.
 */
export function StickyHeaderSpacer({ height = 64 }) {
  return <div style={{ height }} aria-hidden="true" />;
}
