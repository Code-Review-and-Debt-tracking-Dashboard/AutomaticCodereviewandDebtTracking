interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading data...",
  className = "",
}: LoadingStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-4
        rounded-lg border border-border bg-card
        px-6 py-14 text-center
        ${className}
      `}
    >
      <span className="flex items-end gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-4 w-[3px] animate-pulse-soft bg-primary"
            style={{ animationDelay: `${index * 0.18}s` }}
          />
        ))}
      </span>

      <p className="font-mono text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
