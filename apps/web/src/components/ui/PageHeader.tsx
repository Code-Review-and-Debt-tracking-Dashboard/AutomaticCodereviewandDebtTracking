import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className = "" }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-7 ${className}`}
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        {children}
      </div>

      <div className="rule-ticks mt-5" />
    </motion.div>
  );
}

interface SlotProps {
  children: ReactNode;
  className?: string;
}

export function PageHeaderBadge({ children, className = "" }: SlotProps) {
  return (
    <p className={`eyebrow mb-2.5 flex items-center gap-1.5 ${className}`}>
      {children}
    </p>
  );
}

export function PageHeaderTitle({ children, className = "" }: SlotProps) {
  return (
    <h1
      className={`
        font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]
        sm:text-[32px]
        ${className}
      `}
    >
      {children}
    </h1>
  );
}

export function PageHeaderDescription({ children, className = "" }: SlotProps) {
  return (
    <p className={`mt-2 max-w-2xl text-sm text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

export function PageHeaderActions({ children, className = "" }: SlotProps) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      {children}
    </div>
  );
}
