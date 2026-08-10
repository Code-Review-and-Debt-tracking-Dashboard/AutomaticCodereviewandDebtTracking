import type { ComponentType } from "react";
import { Check, Trash2 } from "lucide-react";
import { Badge } from "./Badge";

/*
 * =========================================================
 * NOTIFICATION ITEM — Individual notification row
 * =========================================================
 *
 * Renders a single notification with icon, title,
 * description, timestamp, repo badge, unread indicator,
 * and action buttons. Used on the Notifications page
 * and in the Topbar notification dropdown.
 */

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
  compact = false,
  className = "",
}: NotificationItemProps) {
  return (
    <div
      className={`
        group flex items-start gap-4 rounded-2xl border
        p-4 transition-colors
        ${compact ? "p-3" : "p-4 sm:p-5"}
        ${
          unread
            ? "border-primary/15 bg-primary/[0.03]"
            : "border-border/70 bg-card"
        }
        ${className}
      `}
    >
      {/* Icon */}
      {Icon && (
        <div
          className={`
            flex h-10 w-10 shrink-0 items-center justify-center
            rounded-xl ${iconColor}
          `}
        >
          <Icon size={18} />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold leading-snug">
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

          {unread && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>

        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {description}
        </p>

        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
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
              onClick={onMarkRead}
              title="Mark as read"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Check size={14} />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
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
