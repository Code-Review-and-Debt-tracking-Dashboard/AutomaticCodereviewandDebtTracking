import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileSidebar } from "./MobileSidebar";

export function AppLayout() {
  // Desktop sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  // Current route
  const location = useLocation();

  /*
   * Automatically close the mobile sidebar
   * when the user navigates to another page.
   *
   * Example:
   * /dashboard
   *      ↓ click Repositories
   * /repositories
   *
   * The mobile menu closes automatically.
   */
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">

        {/* =================================
            DESKTOP SIDEBAR
            Visible on lg screens and above
        ================================== */}

        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() =>
            setSidebarCollapsed(
              (previous) => !previous
            )
          }
        />

        {/* =================================
            MOBILE SIDEBAR
            Visible on mobile screens
        ================================== */}

        <MobileSidebar
          open={mobileSidebarOpen}
          onClose={() =>
            setMobileSidebarOpen(false)
          }
        />

        {/* =================================
            MAIN APPLICATION AREA
        ================================== */}

        <div className="flex min-w-0 flex-1 flex-col">

          {/* =================================
              TOPBAR
          ================================== */}

          <Topbar
            onMenuClick={() =>
              setMobileSidebarOpen(
                (previous) => !previous
              )
            }
          />

          {/* =================================
              PAGE CONTENT

              Outlet renders:
              - DashboardPage
              - RepositoryOverviewPage
              - RepositoryTrendsPage
              - RepositoryFindingsPage
              - RepositoryPullRequestsPage
              - RepositoryQualityGatePage
              - RepositoryMembersPage
          ================================== */}

          <main className="relative flex-1 overflow-x-hidden">

            <AnimatePresence
              mode="wait"
              initial={false}
            >
              <motion.div
                key={location.pathname}

                initial={{
                  opacity: 0,
                  y: 8,
                }}

                animate={{
                  opacity: 1,
                  y: 0,
                }}

                exit={{
                  opacity: 0,
                  y: -8,
                }}

                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}

                className="min-h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>

          </main>

        </div>

      </div>
    </div>
  );
}