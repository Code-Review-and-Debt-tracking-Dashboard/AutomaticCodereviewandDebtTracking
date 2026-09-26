import type { ComponentType } from "react";
import { Check, Trash2 } from "lucide-react";
import { Badge } from "./Badge";

interface NotificationItemProps {
  icon?: ComponentType<{ size?: number; className?: string }>;
  iconColor?: string;
  title: string;
  description: string;
  time: string;
  repoName?: string;
  unread?: boolean;
  severity?: "critical" | "high" | "medium" | "low";
  onMarkRead?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

const severityVariant: Record<string, "destructive" | "warning" | "info" | "muted"> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "muted",
};

export function NotificationItem({
  icon: Icon,
  iconColor = "bg-success/10 text-success",
  title,
  description,
  time,
  repoName,
  unread = false,
  severity,
  onMarkRead,
  onDelete,
  onClick,
  compact = false,
  className = "",
}: NotificationItemProps) {
  return (
    <div
      onClick={onClick}
      className={`
        group relative flex items-start gap-3.5 rounded-lg border
        transition-colors
        ${onClick ? "cursor-pointer hover:border-primary/50" : ""}
        ${compact ? "p-3" : "p-4"}
        ${unread ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-card"}
        ${className}
      `}
    >
      {/* Unread marker on the edge */}
      {unread && (
        <span className="absolute inset-y-2 left-0 w-[2px] bg-primary" />
      )}

      {/* Icon */}
      {Icon && (
        <div
          className={`
            flex h-9 w-9 shrink-0 items-center justify-center
            rounded-sm ${iconColor}
          `}
        >
          <Icon size={17} />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-[13px] font-semibold leading-snug">
            {title}
          </p>

          {severity && (
            <Badge
              variant={severityVariant[severity] ?? "muted"}
              size="sm"
            >
              {severity.toUpperCase()}
            </Badge>
          )}
        </div>

        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {description}
        </p>

        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>{time}</span>

          {repoName && (
            <>
              <span>·</span>
              <Badge variant="outline" size="sm">
                {repoName}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {(onMarkRead || onDelete) && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onMarkRead && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead();
              }}
              title="Mark as read"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Check size={14} />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
