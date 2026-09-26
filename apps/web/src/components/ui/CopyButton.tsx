import { useState } from "react";
import type { MouseEvent } from "react";
import { Check, Copy, X } from "lucide-react";

import { Button } from "./Button";

interface CopyButtonProps {
  getText: () => string;
  // leave out for an icon-only button
  label?: string;
  title?: string;
}

export function CopyButton({ getText, label, title = "Copy" }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
      setState("copied");
    } catch {
      // clipboard is blocked outside https or when permission is denied
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  };

  const Icon = state === "copied" ? Check : state === "failed" ? X : Copy;
  const text = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : label;

  return (
    <Button
      type="button"
      variant={label ? "secondary" : "ghost"}
      size={label ? "md" : "icon"}
      onClick={copy}
      title={label ? undefined : state === "idle" ? title : text}
      aria-label={label ? undefined : title}
    >
      <Icon size={14} />
      {label && text}
    </Button>
  );
}
