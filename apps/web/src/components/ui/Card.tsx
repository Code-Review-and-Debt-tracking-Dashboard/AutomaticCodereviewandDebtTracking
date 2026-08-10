import type { ReactNode, HTMLAttributes } from "react";

/*
 * =========================================================
 * CARD — Composable card components
 * =========================================================
 *
 * Slot-based API inspired by shadcn/ui Card.
 * Card / CardHeader / CardTitle / CardDescription /
 * CardContent / CardFooter
 */

/* ---------- Card Root ---------- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: boolean;
  className?: string;
}

export function Card({
  children,
  glow = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-2xl border border-border/70 bg-card
        ${glow ? "card-glow" : ""}
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
        flex items-start justify-between gap-4 p-5 sm:p-6
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
    <p className={`text-sm font-semibold ${className}`}>
      {children}
    </p>
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
  return (
    <div className={`px-5 pb-5 sm:px-6 sm:pb-6 ${className}`}>
      {children}
    </div>
  );
}

/* ---------- Card Footer ---------- */

export function CardFooter({ children, className = "" }: CardSlotProps) {
  return (
    <div
      className={`
        border-t border-border/60 px-5 py-4 sm:px-6
        ${className}
      `}
    >
      {children}
    </div>
  );
}
