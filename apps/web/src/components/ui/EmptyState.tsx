import type { ComponentType, ReactNode } from "react";

import { FlatlineIllustration } from "../icons";

interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; className?: string }>;
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
        flex flex-col items-center justify-center gap-4
        rounded-lg border border-dashed border-border bg-card/40
        px-6 py-14 text-center
        ${className}
      `}
    >
      <span className="relative flex items-center justify-center">
        <FlatlineIllustration className="text-muted-foreground" />

        {Icon && (
          <span className="absolute flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground">
            <Icon size={17} />
          </span>
        )}
      </span>

      <div>
        <p className="font-display text-[15px] font-semibold">{title}</p>

        {description && (
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}
