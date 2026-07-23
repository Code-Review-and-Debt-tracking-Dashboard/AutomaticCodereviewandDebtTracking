import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Code2,
  GitPullRequest,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
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

export function MobileSidebar({
  open,
  onClose,
}: MobileSidebarProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* BACKDROP */}
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
          />

          {/* SIDEBAR */}
          <motion.aside
            initial={{
              x: "-100%",
            }}
            animate={{
              x: 0,
            }}
            exit={{
              x: "-100%",
            }}
            transition={{
              duration: 0.25,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-card shadow-2xl lg:hidden"
          >
            <div className="flex h-full flex-col">

              {/* BRAND */}
              <div className="flex h-20 items-center justify-between border-b border-border/60 px-5">
                <NavLink
                  to="/dashboard"
                  onClick={onClose}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <Bot size={21} />
                  </div>

                  <div>
                    <p className="text-sm font-bold">
                      CodeGuard
                    </p>

                    <p className="text-[10px] text-muted-foreground">
                      Code intelligence
                    </p>
                  </div>
                </NavLink>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close sidebar"
                >
                  <X size={19} />
                </button>
              </div>

              {/* NAVIGATION */}
              <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">

                <MobileNavigationSection
                  title="Workspace"
                  items={navigationItems}
                  onClose={onClose}
                />

                <MobileNavigationSection
                  title="Management"
                  items={managementItems}
                  onClose={onClose}
                />

              </nav>

              {/* SYSTEM STATUS */}
              <div className="mx-3 mb-5 rounded-2xl border border-success/20 bg-success/5 p-4">
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
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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

interface MobileNavigationSectionProps {
  title: string;
  items: NavigationItem[];
  onClose: () => void;
}

function MobileNavigationSection({
  title,
  items,
  onClose,
}: MobileNavigationSectionProps) {
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>

      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all",
                  isActive
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")
              }
            >
              <Icon size={18} />

              <span>{item.label}</span>

              {item.label === "Notifications" && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  3
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}