import type { ReactNode } from "react";
import clsx from "clsx";

export function SparkleCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "relative rounded-3xl bg-white/80 px-8 py-6 shadow-xl shadow-brand/20 backdrop-blur",
        "border border-brand/20 overflow-hidden",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#bbf7d0_0,_transparent_50%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}


