import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Logo } from "../brand/Logo";
import { useUnreadNotifications } from "../../lib/useUnreadNotifications";
import { managementItems, workspaceItems, type NavItem } from "./navItems";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 244 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
    >
      {/* Brand */}
      <div
        className={`flex h-14 shrink-0 items-center border-b border-sidebar-border ${
          collapsed ? "justify-center" : "px-4"
        }`}
      >
        <NavLink to="/dashboard" aria-label="CodePulse home">
          {collapsed ? <Logo variant="mark" size={24} /> : <Logo size={26} />}
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-5">
        <NavSection title="Workspace" items={workspaceItems} collapsed={collapsed} />

        <div className="mt-6">
          <NavSection title="Manage" items={managementItems} collapsed={collapsed} />
        </div>
      </nav>

      {/* Collapse control — stays reachable in both states */}
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}

          {!collapsed && (
            <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
              Collapse
            </span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

interface NavSectionProps {
  title: string;
  items: NavItem[];
  collapsed: boolean;
}

function NavSection({ title, items, collapsed }: NavSectionProps) {
  const unreadCount = useUnreadNotifications();

  return (
    <div>
      {!collapsed && (
        <p className="eyebrow mb-2 px-2.5 text-[10px]">{title}</p>
      )}

      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  "group relative flex h-9 items-center gap-2.5 rounded-md text-[13px] transition-colors",
                  collapsed ? "justify-center px-0" : "px-2.5",
                  isActive
                    ? "bg-accent font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-marker"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-primary"
                    />
                  )}

                  <Icon size={18} className="shrink-0" />

                  {!collapsed && <span className="truncate">{item.label}</span>}

                  {!collapsed &&
                    item.label === "Notifications" &&
                    unreadCount > 0 && (
                      <span className="ml-auto font-mono text-[11px] text-primary">
                        {unreadCount}
                      </span>
                    )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
