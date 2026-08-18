import type { ComponentType, ReactNode } from "react";

/*
 * =========================================================
 * EMPTY STATE — Centered empty-list placeholder
 * =========================================================
 *
 * Displays a centered icon + message + optional action
 * button when a list or section has no data.
 */

interface EmptyStateProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-3
        rounded-2xl border border-border/70 bg-card
        p-12 text-center
        ${className}
      `}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon size={24} className="text-muted-foreground" />
      </div>

      <p className="text-sm font-semibold">
        {title}
      </p>

      {description && (
        <p className="max-w-sm text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}
