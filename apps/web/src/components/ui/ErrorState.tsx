import { RefreshCw } from "lucide-react";

import { AlertIcon } from "../icons";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Failed to load data",
  message = "An error occurred while fetching information. Please try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-3
        rounded-lg border border-destructive/30 bg-destructive/5
        px-6 py-12 text-center
        ${className}
      `}
    >
      <AlertIcon size={24} className="text-destructive" />

      <div>
        <h3 className="font-display text-[15px] font-semibold">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>

      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw size={13} />
          Retry
        </Button>
      )}
    </div>
  );
}
