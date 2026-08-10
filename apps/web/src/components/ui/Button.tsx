import type { ReactNode, ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";

/*
 * =========================================================
 * BUTTON — Multi-variant button component
 * =========================================================
 *
 * Inspired by shadcn/ui Button with Framer Motion tap
 * animation. Supports primary, secondary, ghost, outline,
 * destructive variants and sm/md/lg/icon sizes.
 */

const variantClasses: Record<string, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:-translate-y-0.5 hover:shadow-primary/30",
  secondary:
    "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
  ghost:
    "text-muted-foreground hover:bg-muted hover:text-foreground",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted",
  destructive:
    "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
  "destructive-solid":
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-5 py-3 text-sm gap-2.5",
  icon: "h-10 w-10 justify-center p-0",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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
      whileTap={{ scale: 0.97 }}
      type={type}
      className={`
        inline-flex items-center justify-center
        rounded-xl font-semibold
        transition-all duration-200
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
