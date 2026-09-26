import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`
        rounded-lg border border-border bg-card
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardSlotProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardSlotProps) {
  return (
    <div
      className={`
        flex items-start justify-between gap-4
        border-b border-border px-5 py-4
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }: CardSlotProps) {
  return (
    <h3 className={`font-display text-[15px] font-semibold tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = "" }: CardSlotProps) {
  return (
    <p className={`mt-1 text-xs text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "" }: CardSlotProps) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: CardSlotProps) {
  return (
    <div className={`border-t border-border px-5 py-3.5 ${className}`}>
      {children}
    </div>
  );
}
