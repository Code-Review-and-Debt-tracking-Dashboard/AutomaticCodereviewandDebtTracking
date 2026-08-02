
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOrg } from "../../contexts/OrgContext";
import { api } from "../../lib/apiClient";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({
  onMenuClick,
}: TopbarProps) {
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const { orgs, selectedOrg, setSelectedOrg } = useOrg();

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const profileRef =
    useRef<HTMLDivElement>(null);

  const orgDropdownRef =
    useRef<HTMLDivElement>(null);

  const [darkMode, setDarkMode] =
    useState<boolean>(() => {
      const savedTheme =
        localStorage.getItem("theme");

      if (savedTheme) {
        return savedTheme === "dark";
      }

      return true;
    });

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [orgOpen, setOrgOpen] =
    useState(false);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const user = {
    name: authUser?.username || "Developer",
    username: authUser?.username || "user",
    role: authUser?.platformRole || "Developer",
    initials: (authUser?.username || "NB").slice(0, 2).toUpperCase(),
    avatarUrl: authUser?.avatarUrl,
  };


  /*
   * =====================================================
   * BACKEND CONNECTION LATER
   * =====================================================
   *
   * GET /api/notifications
   *
   * Backend response:
   *
   * [
   *   {
   *     id: string;
   *     type: "ANALYSIS_COMPLETED";
   *     title: string;
   *     message: string;
   *     isRead: boolean;
   *     createdAt: string;
   *   }
   * ]
   */

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "demo-1",
      title: "Analysis completed",
      description:
        "AutomaticCodeReview analysis completed",
      time: "8 min ago",
      unread: true,
    },
    {
      id: "demo-2",
      title: "New security finding",
      description:
        "A security issue was detected",
      time: "32 min ago",
      unread: true,
    },
    {
      id: "demo-3",
      title: "Pull request analyzed",
      description:
        "PR #42 was analyzed successfully",
      time: "1 hour ago",
      unread: false,
    },
  ]);

  const unreadCount =
    notifications.filter(
      (notification) =>
        notification.unread,
    ).length;

  /*
   * =====================================================
   * THEME MANAGEMENT
   * =====================================================
   */

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      darkMode,
    );

    localStorage.setItem(
      "theme",
      darkMode ? "dark" : "light",
    );
  }, [darkMode]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    const fetchNotifications = async () => {
      try {
        const response = await api.get<{ data: Array<{
          id: string;
          title: string;
          body: string;
          readAt: string | null;
          createdAt: string;
        }> }>("/api/notifications", { unreadOnly: true });

        const mapped = (response.data || []).map((notification) => ({
          id: notification.id,
          title: notification.title,
          description: notification.body,
          time: new Date(notification.createdAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          unread: !notification.readAt,
        }));

        if (mapped.length > 0) {
          setNotifications(mapped);
        }
      } catch {
        // Keep the demo fallback notifications if the API is unavailable.
      }
    };

    fetchNotifications();
  }, [authUser, notificationsOpen]);

  const toggleTheme = () => {
    setDarkMode(
      (previous) => !previous,
    );
  };

  /*
   * =====================================================
   * KEYBOARD SEARCH SHORTCUT
   * =====================================================
   *
   * Press "/" to focus search.
   */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !==
          "INPUT"
      ) {
        event.preventDefault();

        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setSearchOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  /*
   * =====================================================
   * CLOSE PROFILE DROPDOWN OUTSIDE CLICK
   * =====================================================
   */

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      const target =
        event.target as Node;

      if (
        profileRef.current &&
        !profileRef.current.contains(
          target,
        )
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  /*
   * =====================================================
   * LOGOUT
   * =====================================================
   *
   * CURRENT:
   * Clears local authentication data.
   *
   * BACKEND LATER:
   *
   * POST /auth/logout
   *
   * Then:
   * 1. Invalidate backend session
   * 2. Clear JWT/token
   * 3. Clear auth store
   * 4. Navigate to /login
   */

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(
        "Logout failed:",
        error,
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:px-6">

      {/* =====================================================
          LEFT SIDE
          ===================================================== */}

      <div className="flex min-w-0 items-center gap-3">

        {/* MOBILE MENU */}

        <motion.button
          whileTap={{
            scale: 0.9,
          }}
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu size={20} />
        </motion.button>

        {/* DESKTOP SEARCH */}

        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 md:flex md:w-72">

          <Search
            size={17}
            className="shrink-0 text-muted-foreground"
          />

          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search repositories..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />

          <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">
            /
          </kbd>
        </div>

        {/* ORGANIZATION SWITCHER (D-20) */}

        <div ref={orgDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setOrgOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-muted"
          >
            {selectedOrg?.avatarUrl ? (
              <img
                src={selectedOrg.avatarUrl}
                alt={selectedOrg.login}
                className="h-5 w-5 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/20 text-primary">
                <Building2 size={12} />
              </div>
            )}
            <span className="max-w-[120px] truncate sm:max-w-[160px]">
              {selectedOrg?.name || selectedOrg?.login || "Select Org"}
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          </button>

          <AnimatePresence>
            {orgOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                className="absolute left-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl z-50"
              >
                <div className="border-b border-border px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Organizations
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {orgs.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No organizations found</p>
                  ) : (
                    orgs.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrg(org);
                          setOrgOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                          selectedOrg?.id === org.id
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {org.avatarUrl ? (
                          <img src={org.avatarUrl} alt="" className="h-5 w-5 rounded-md" />
                        ) : (
                          <Building2 size={14} />
                        )}
                        <span className="truncate">{org.name || org.login}</span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


        {/* MOBILE SEARCH BUTTON */}

        <motion.button
          whileTap={{
            scale: 0.9,
          }}
          type="button"
          onClick={() =>
            setSearchOpen(
              (previous) => !previous,
            )
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Open search"
        >
          {searchOpen ? (
            <X size={18} />
          ) : (
            <Search size={18} />
          )}
        </motion.button>
      </div>

      {/* =====================================================
          RIGHT SIDE
          ===================================================== */}

      <div className="flex items-center gap-2 sm:gap-3">

        {/* THEME TOGGLE */}

        <motion.button
          whileTap={{
            scale: 0.9,
          }}
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:bg-muted hover:text-foreground"
        >
          <AnimatePresence
            mode="wait"
            initial={false}
          >
            {darkMode ? (
              <motion.div
                key="sun"
                initial={{
                  opacity: 0,
                  rotate: -90,
                  scale: 0.5,
                }}
                animate={{
                  opacity: 1,
                  rotate: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  rotate: 90,
                  scale: 0.5,
                }}
              >
                <Sun size={18} />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{
                  opacity: 0,
                  rotate: 90,
                  scale: 0.5,
                }}
                animate={{
                  opacity: 1,
                  rotate: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  rotate: -90,
                  scale: 0.5,
                }}
              >
                <Moon size={18} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* NOTIFICATIONS */}

        <div className="relative">

          <motion.button
            whileTap={{
              scale: 0.9,
            }}
            type="button"
            onClick={() => {
              setNotificationsOpen(
                (previous) =>
                  !previous,
              );

              setProfileOpen(false);
            }}
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:bg-muted hover:text-foreground"
          >
            <Bell size={18} />

            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: -8,
                  scale: 0.96,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                  scale: 0.96,
                }}
                className=" bg-white dark:bg-slate-950 absolute right-0 mt-3 w-80  z-[9999] overflow-hidden rounded-2xl border-2 border-primary bg-card  backdrop-blur-md"
              >

                <div className="border-b border-border p-4">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-sm font-semibold">
                        Notifications
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {unreadCount} unread
                      </p>
                    </div>

                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">

                  {notifications.map(
                    (
                      notification,
                    ) => (
                      <div
                        key={
                          notification.id
                        }
                        className="border-b border-border/50 p-4 transition hover:bg-muted/50"
                      >

                        <div className="flex gap-3">

                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              notification.unread
                                ? "bg-primary"
                                : "bg-muted"
                            }`}
                          />

                          <div className="min-w-0">

                            <p className="text-sm font-medium">
                              {
                                notification.title
                              }
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {
                                notification.description
                              }
                            </p>

                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {
                                notification.time
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  className="w-full p-3 text-center text-xs font-medium text-primary transition hover:bg-muted/50"
                >
                  View all notifications
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PROFILE */}

        <div
          ref={profileRef}
          className="relative"
        >

          <button
            type="button"
            onClick={() => {
              setProfileOpen(
                (previous) =>
                  !previous,
              );

              setNotificationsOpen(
                false,
              );
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 transition hover:bg-muted sm:px-3"
          >

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {user.initials}
            </div>

            <div className="hidden text-left sm:block">

              <p className="text-xs font-semibold">
                {user.name}
              </p>

              <p className="text-[10px] text-muted-foreground">
                @{user.username}
              </p>
            </div>

            <ChevronDown
              size={15}
              className="hidden text-muted-foreground sm:block"
            />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: -8,
                  scale: 0.96,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                  scale: 0.96,
                }}
                className="absolute right-0 top-14 w-56 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl"
              >

                <div className="border-b border-border px-3 py-3">

                  <p className="text-sm font-semibold">
                    {user.name}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    @{user.username}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/settings")
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <UserIcon size={16} />
                  Profile
                </button>

                <div className="my-2 h-px bg-border" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive transition hover:bg-destructive/10"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MOBILE SEARCH PANEL */}

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: "auto",
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            className="absolute left-0 right-0 top-20 border-b border-border bg-background px-4 py-3 md:hidden"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">

              <Search
                size={17}
                className="text-muted-foreground"
              />

              <input
                autoFocus
                type="text"
                placeholder="Search repositories..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

