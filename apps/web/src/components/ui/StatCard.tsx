import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

import { InfoHint } from "./InfoHint";

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
  /** shown on hover */
  help?: string;
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
  help,
  delay = 0,
  className = "",
}: StatCardProps) {
  const resolvedIconColor =
    iconColor || (color ? colorClasses[color] : colorClasses.primary);

  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`
        group relative rounded-lg border border-border
        bg-card px-5 py-4 transition-colors hover:border-primary/50
        ${className}
      `}
    >
      {/* Corner marker */}
      <span
        className={`
          absolute right-4 top-4 flex h-7 w-7 items-center justify-center
          rounded-sm ${resolvedIconColor}
        `}
      >
        <Icon size={15} />
      </span>

      <p className="eyebrow flex items-center gap-1.5 pr-10">
        {title}
        {help && <InfoHint text={help} />}
      </p>

      <div className="mt-3 flex items-baseline gap-2.5">
        <p className="font-mono text-[28px] font-semibold leading-none tracking-tight">
          {value}
        </p>

        {change && (
          <span
            className={`flex items-center gap-0.5 font-mono text-[11px] ${trendColor}`}
          >
            {trend === "up" && <ArrowUpRight size={12} />}
            {trend === "down" && <ArrowDownRight size={12} />}
            {change}
          </span>
        )}
      </div>

      {/* Baseline trace that lights up on hover */}
      <span className="absolute inset-x-0 bottom-0 h-px rounded-b-lg bg-primary/0 transition-colors group-hover:bg-primary/60" />
    </motion.div>
  );
}
