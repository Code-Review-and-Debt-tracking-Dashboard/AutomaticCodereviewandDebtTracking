import type { ReactNode } from "react";

/*
 * =========================================================
 * TAB GROUP — Pill-style tab switcher
 * =========================================================
 *
 * Renders a row of pill-shaped tabs with active state
 * and optional count badges. Used on the Notifications
 * page (All / Unread / Critical).
 */

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function TabGroup({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: TabGroupProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-1 rounded-xl
        border border-border bg-card p-1
        ${className}
      `}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              inline-flex items-center gap-2 rounded-lg
              px-3 py-2 text-xs font-semibold
              transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            `}
          >
            {tab.label}

            {tab.count !== undefined && (
              <span
                className={`
                  inline-flex h-5 min-w-5 items-center
                  justify-center rounded-full px-1.5
                  text-[10px] font-bold
                  ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
