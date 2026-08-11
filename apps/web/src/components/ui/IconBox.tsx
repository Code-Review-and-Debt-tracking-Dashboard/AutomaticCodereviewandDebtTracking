import type { ComponentType } from "react";

/*
 * =========================================================
 * ICON BOX — Colored icon container
 * =========================================================
 *
 * Replaces the repeated pattern of a colored rounded
 * container holding a Lucide icon. Supports color variants
 * matching the design token palette.
 */

const colorClasses: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
};

const sizeClasses: Record<string, { box: string; icon: number }> = {
  sm: { box: "h-9 w-9 rounded-lg", icon: 16 },
  md: { box: "h-11 w-11 rounded-xl", icon: 20 },
  lg: { box: "h-12 w-12 rounded-xl", icon: 22 },
};

interface IconBoxProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  color?: keyof typeof colorClasses;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function IconBox({
  icon: Icon,
  color = "primary",
  size = "md",
  className = "",
}: IconBoxProps) {
  const s = sizeClasses[size] ?? sizeClasses.md;

  return (
    <div
      className={`
        flex shrink-0 items-center justify-center
        ${s.box}
        ${colorClasses[color] ?? colorClasses.primary}
        ${className}
      `}
    >
      <Icon size={s.icon} />
    </div>
  );
}
