import type { ReactNode } from "react";

/*
 * =========================================================
 * BADGE — Status chip
 * =========================================================
 *
 * Squared-off mono chips so severity and status read like
 * readings on a panel rather than decorative pills.
 */

const variantClasses: Record<string, string> = {
  default:
    "bg-primary/10 text-primary border-primary/25",
  success:
    "bg-success/10 text-success border-success/25",
  warning:
    "bg-warning/10 text-warning border-warning/25",
  destructive:
    "bg-destructive/10 text-destructive border-destructive/25",
  info:
    "bg-info/10 text-info border-info/25",
  outline:
    "bg-transparent text-muted-foreground border-border",
  muted:
    "bg-muted text-muted-foreground border-border",
};

const sizeClasses: Record<string, string> = {
  sm: "h-[18px] px-1.5 text-[10px]",
  md: "h-[22px] px-2 text-[10px]",
  lg: "h-[26px] px-2.5 text-[11px]",
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
        inline-flex items-center gap-1.5 whitespace-nowrap
        rounded-sm border font-mono uppercase tracking-[0.06em]
        ${variantClasses[variant] ?? variantClasses.default}
        ${sizeClasses[size] ?? sizeClasses.md}
        ${className}
      `}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
