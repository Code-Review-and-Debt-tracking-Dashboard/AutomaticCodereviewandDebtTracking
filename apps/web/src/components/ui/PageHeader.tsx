import type { ReactNode } from "react";
import { motion } from "framer-motion";

/*
 * =========================================================
 * PAGE HEADER — Composable page header component
 * =========================================================
 *
 * Provides consistent page header layout across all pages.
 *
 * Slots:
 *   PageHeader       — outer flex container
 *   PageHeaderBadge  — optional pill decoration
 *   PageHeaderTitle  — h1 heading
 *   PageHeaderDescription — subtitle text
 *   PageHeaderActions — right-aligned action buttons
 */

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className = "" }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        mb-8 flex flex-col justify-between gap-4
        sm:flex-row sm:items-end
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Badge / Pill ---------- */

interface SlotProps {
  children: ReactNode;
  className?: string;
}

export function PageHeaderBadge({ children, className = "" }: SlotProps) {
  return (
    <div
      className={`
        mb-3 inline-flex items-center gap-2 rounded-full
        border border-primary/80 bg-primary/10
        px-3 py-1.5 text-xs font-medium text-primary
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* ---------- Title ---------- */

export function PageHeaderTitle({ children, className = "" }: SlotProps) {
  return (
    <h1
      className={`
        text-3xl font-bold tracking-tight sm:text-4xl
        ${className}
      `}
    >
      {children}
    </h1>
  );
}

/* ---------- Description ---------- */

export function PageHeaderDescription({ children, className = "" }: SlotProps) {
  return (
    <p
      className={`
        mt-2 text-sm text-muted-foreground
        ${className}
      `}
    >
      {children}
    </p>
  );
}

/* ---------- Actions ---------- */

export function PageHeaderActions({ children, className = "" }: SlotProps) {
  return (
    <div
      className={`
        flex shrink-0 items-center gap-3
        ${className}
      `}
    >
      {children}
    </div>
  );
}
