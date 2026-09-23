import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Logo } from "../brand/Logo";
import { useUnreadNotifications } from "../../lib/useUnreadNotifications";
import { usePreference } from "../../lib/usePreference";
import { managementItems, workspaceItems, type NavItem } from "./navItems";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
          />

          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl md:hidden"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
              <NavLink to="/dashboard" onClick={onClose} aria-label="CodePulse home">
                <Logo size={26} />
              </NavLink>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-5">
              <MobileNavSection
                title="Workspace"
                items={workspaceItems}
                onClose={onClose}
              />

              <div className="mt-6">
                <MobileNavSection
                  title="Manage"
                  items={managementItems}
                  onClose={onClose}
                />
              </div>
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

interface MobileNavSectionProps {
  title: string;
  items: NavItem[];
  onClose: () => void;
}

function MobileNavSection({ title, items, onClose }: MobileNavSectionProps) {
  const unreadCount = useUnreadNotifications();
  const [badge] = usePreference<"on" | "off">("notificationBadge", "on");

  return (
    <div>
      <p className="eyebrow mb-2 px-2.5 text-[10px]">{title}</p>

      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-accent font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-primary" />
                  )}

                  <Icon size={18} className="shrink-0" />

                  <span>{item.label}</span>

                  {item.label === "Notifications" && badge === "on" && unreadCount > 0 && (
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
