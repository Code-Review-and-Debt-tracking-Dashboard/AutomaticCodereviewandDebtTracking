import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileSidebar } from "./MobileSidebar";
import { Tour } from "../tour/Tour";

const COLLAPSE_KEY = "sidebarCollapsed";

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "true",
  );

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const location = useLocation();

  // close the drawer whenever the route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => {
      localStorage.setItem(COLLAPSE_KEY, String(!previous));
      return !previous;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <MobileSidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* only this column scrolls */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar onMenuClick={() => setMobileSidebarOpen((previous) => !previous)} />

        <main className="flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-10 lg:py-9"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <Tour />
    </div>
  );
}
