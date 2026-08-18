import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/*
 * =========================================================
 * STAT CARD — Dashboard statistic card
 * =========================================================
 *
 * Reusable card for displaying a single KPI with icon,
 * title, value, change text, and trend direction.
 *
 * Used across Dashboard (4), Findings (4), Analytics (4),
 * and Pull Requests (3) pages.
 */

const colorClasses: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  danger: "bg-destructive/10 text-destructive", // Alias for destructive
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
};

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: ComponentType<{ size?: number; className?: string }>;
  iconColor?: string;
  color?: keyof typeof colorClasses;
  delay?: number;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor,
  color,
  delay = 0,
  className = "",
}: StatCardProps) {
  const resolvedIconColor = iconColor || (color ? colorClasses[color] : colorClasses.primary);

  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`
        group rounded-2xl border border-border bg-card p-5
        transition hover:-translate-y-1 hover:border-primary/60
        hover:shadow-xl
        ${className}
      `}
    >
      {/* Icon */}
      <div
        className={`
          flex h-11 w-11 items-center justify-center rounded-xl
          ${resolvedIconColor}
        `}
      >
        <Icon size={20} />
      </div>

      {/* Label */}
      <p className="mt-5 text-sm text-muted-foreground">
        {title}
      </p>

      {/* Value + Change */}
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight">
          {value}
        </p>

        {change && (
          <div
            className={`
              flex items-center gap-1 text-xs font-medium
              ${trendColor}
            `}
          >
            {trend === "up" && <ArrowUpRight size={14} />}
            {trend === "down" && <ArrowDownRight size={14} />}
            {change}
          </div>
        )}
      </div>
    </motion.div>
  );
}
