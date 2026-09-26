import type { ReactNode, ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";

/*
 * =========================================================
 * BUTTON — Multi-variant button component
 * =========================================================
 *
 * Flat and square-ish. No lift, no glow — the only motion
 * is a small press.
 */

const variantClasses: Record<string, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary:
    "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent",
  ghost:
    "text-muted-foreground hover:bg-accent hover:text-foreground",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-accent",
  destructive:
    "bg-destructive/10 text-destructive border border-destructive/25 hover:bg-destructive/20",
  "destructive-solid":
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizeClasses: Record<string, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-10 px-4 text-sm gap-2",
  icon: "h-9 w-9 justify-center p-0",
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  children: ReactNode;
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type={type}
      className={`
        inline-flex shrink-0 items-center justify-center
        rounded-md font-medium
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        disabled:pointer-events-none disabled:opacity-50
        ${variantClasses[variant] ?? variantClasses.primary}
        ${sizeClasses[size] ?? sizeClasses.md}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.button>
  );
}
