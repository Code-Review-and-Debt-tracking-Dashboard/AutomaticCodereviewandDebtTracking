import type { ReactNode, HTMLAttributes } from "react";

/*
 * =========================================================
 * CARD — Composable card components
 * =========================================================
 *
 * Slot-based API: Card / CardHeader / CardTitle /
 * CardDescription / CardContent / CardFooter
 */

/* ---------- Card Root ---------- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`
        rounded-lg border border-border bg-card
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

/* ---------- Card Header ---------- */

interface CardSlotProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardSlotProps) {
  return (
    <div
      className={`
        flex items-start justify-between gap-4
        border-b border-border px-5 py-4
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* ---------- Card Title ---------- */

export function CardTitle({ children, className = "" }: CardSlotProps) {
  return (
    <h3 className={`font-display text-[15px] font-semibold tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

/* ---------- Card Description ---------- */

export function CardDescription({ children, className = "" }: CardSlotProps) {
  return (
    <p className={`mt-1 text-xs text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

/* ---------- Card Content ---------- */

export function CardContent({ children, className = "" }: CardSlotProps) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

/* ---------- Card Footer ---------- */

export function CardFooter({ children, className = "" }: CardSlotProps) {
  return (
    <div className={`border-t border-border px-5 py-3.5 ${className}`}>
      {children}
    </div>
  );
}
