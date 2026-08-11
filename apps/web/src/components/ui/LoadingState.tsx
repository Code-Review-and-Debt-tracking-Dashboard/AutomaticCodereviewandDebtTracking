import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * Step 59 (D-17): Loading state component across web pages
 */
export function LoadingState({
  message = "Loading data...",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-3
        rounded-2xl border border-border/70 bg-card/60
        p-12 text-center backdrop-blur-sm
        ${className}
      `}
    >
      <Loader2 size={28} className="animate-spin text-primary" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
