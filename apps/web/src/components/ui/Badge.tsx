import type { ReactNode } from "react";

/*
 * =========================================================
 * BADGE — Reusable label / pill component
 * =========================================================
 *
 * Variants mirror severity levels, status labels, and
 * general-purpose decorations used across the dashboard.
 *
 * Inspired by shadcn/ui Badge + Chakra UI Tag.
 */

const variantClasses: Record<string, string> = {
  default:
    "bg-primary/10 text-primary border-primary/20",
  success:
    "bg-success/10 text-success border-success/20",
  warning:
    "bg-warning/10 text-warning border-warning/20",
  destructive:
    "bg-destructive/10 text-destructive border-destructive/20",
  info:
    "bg-info/10 text-info border-info/20",
  outline:
    "bg-transparent text-muted-foreground border-border",
  muted:
    "bg-muted text-muted-foreground border-border/60",
};

const sizeClasses: Record<string, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-xs",
};

interface BadgeProps {
  children: ReactNode;
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  className?: string;
  dot?: boolean;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full border font-medium
        leading-none whitespace-nowrap
        ${variantClasses[variant] ?? variantClasses.default}
        ${sizeClasses[size] ?? sizeClasses.md}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`
            h-1.5 w-1.5 shrink-0 rounded-full
            bg-current
          `}
        />
      )}
      {children}
    </span>
  );
}
