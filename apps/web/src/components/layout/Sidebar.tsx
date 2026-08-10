import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitPullRequest,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "../ui/Badge";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navigationItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    label: "Repositories",
    icon: Code2,
    path: "/repositories",
  },
  {
    label: "Pull Requests",
    icon: GitPullRequest,
    path: "/pull-requests",
  },
  {
    label: "Findings",
    icon: ShieldCheck,
    path: "/findings",
  },
  {
    label: "Analytics",
    icon: BarChart3,
    path: "/analytics",
  },
];

const managementItems = [
  {
    label: "Notifications",
    icon: Bell,
    path: "/notifications",
  },
  {
    label: "Members",
    icon: Users,
    path: "/members",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];

export function Sidebar({
  collapsed,
  onToggle,
}: SidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{
        width: collapsed ? 76 : 260,
      }}
      transition={{
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative hidden min-h-screen shrink-0 border-r border-border/70 bg-card/80 backdrop-blur-xl lg:flex"
    >
      <div className="flex w-full flex-col">
        {/* Brand */}
        <div
          className={`flex h-20 items-center border-b border-border/60 ${
            collapsed
              ? "justify-center"
              : "justify-between px-5"
          }`}
        >
          <NavLink
            to="/dashboard"
            className="flex items-center gap-3"
          >
            <motion.div
              whileHover={{
                rotate: 8,
                scale: 1.05,
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Bot size={21} />
            </motion.div>

            {!collapsed && (
              <motion.div
                initial={{
                  opacity: 0,
                  x: -8,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                className="min-w-0"
              >
                <p className="truncate text-sm font-bold tracking-tight">
                  CodeGuard
                </p>

                <p className="text-[10px] text-muted-foreground">
                  Code intelligence
                </p>
              </motion.div>
            )}
          </NavLink>

          {!collapsed && (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={17} />
            </button>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-7 px-3 py-6">
          <NavigationSection
            title="Workspace"
            items={navigationItems}
            collapsed={collapsed}
          />

          <NavigationSection
            title="Management"
            items={managementItems}
            collapsed={collapsed}
          />
        </nav>

        {/* System Status */}
        {!collapsed && (
          <div className="mx-3 mb-4 rounded-2xl border border-success/20 bg-success/5 p-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>

              <span className="text-xs font-medium text-success">
                All systems operational
              </span>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Analysis workers are running normally.
            </p>
          </div>
        )}

        {/* Collapse Button */}
        {collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="mx-auto mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronRight size={17} />
          </button>
        )}
      </div>
    </motion.aside>
  );
}

interface NavigationItem {
  label: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
  }>;
  path: string;
}

interface NavigationSectionProps {
  title: string;
  items: NavigationItem[];
  collapsed: boolean;
}

function NavigationSection({
  title,
  items,
  collapsed,
}: NavigationSectionProps) {
  return (
    <div>
      {!collapsed && (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
      )}

      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                  collapsed
                    ? "justify-center"
                    : "justify-start",
                  isActive
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="active-sidebar-indicator"
                      className="absolute -left-3 h-7 w-1 rounded-r-full bg-primary"
                    />
                  )}

                  <Icon
                    size={18}
                    className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                  />

                  {!collapsed && (
                    <span className="truncate">
                      {item.label}
                    </span>
                  )}

                  {!collapsed &&
                    item.label === "Notifications" && (
                      <Badge variant="default" size="sm" className="ml-auto">
                        3
                      </Badge>
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