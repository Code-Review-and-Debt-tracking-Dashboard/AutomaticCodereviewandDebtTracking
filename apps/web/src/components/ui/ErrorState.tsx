import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Step 59 (D-17): Error state component across web pages
 */
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
        rounded-2xl border border-destructive/20 bg-destructive/5
        p-12 text-center
        ${className}
      `}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle size={24} />
      </div>

      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="mt-2 gap-2"
        >
          <RefreshCw size={14} />
          Retry
        </Button>
      )}
    </div>
  );
}
