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
    <div className={`flex items-center gap-5 border-b border-border ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              relative -mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 pb-2.5
              text-sm font-medium transition-colors
              ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/70 hover:border-border hover:text-foreground"
              }
            `}
          >
            {tab.label}

            {tab.count !== undefined && (
              <span
                className={`font-mono text-[11px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
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
