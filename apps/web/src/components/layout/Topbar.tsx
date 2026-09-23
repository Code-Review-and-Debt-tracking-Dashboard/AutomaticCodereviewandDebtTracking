import { AnimatePresence, motion } from "framer-motion";
import {
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

import { NotificationIcon } from "../icons";

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

const controlClass =
  "flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground";

export function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate();

  const { user: authUser, logout } = useAuth();

  const { orgs, selectedOrg, setSelectedOrg } = useOrg();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const profileRef = useRef<HTMLDivElement>(null);

  const orgDropdownRef = useRef<HTMLDivElement>(null);

  const notificationRef = useRef<HTMLDivElement>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");

    if (saved) {
      return saved === "dark";
    }

    return true;
  });

  const [profileOpen, setProfileOpen] = useState(false);

  const [orgOpen, setOrgOpen] = useState(false);

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const user = {
    name: authUser?.username || "Nethmi Bhagya",

    username: authUser?.username || "nethmibhagya",

    role: authUser?.platformRole || "Developer",

    initials: (authUser?.username || "NB").slice(0, 2).toUpperCase(),

    avatarUrl: authUser?.avatarUrl,
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const unreadCount = notifications.filter((item) => item.unread).length;

  /*
==============================
THEME
==============================
*/

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);

    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  /*
==============================
NOTIFICATIONS API
==============================
*/

  useEffect(() => {
    if (!authUser) return;

    const fetchNotifications = async () => {
      try {
        setLoadingNotifications(true);

        const response = await api.get<{
          data: Array<{
            id: string;

            title: string;

            body: string;

            readAt: string | null;

            createdAt: string;
          }>;
        }>("/api/notifications", {
          unreadOnly: true,
        });

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

        setNotifications(mapped);
      } catch {
        setNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [authUser]);

  /*
==============================
KEYBOARD SHORTCUT
==============================
*/

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();

        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setProfileOpen(false);

        setNotificationsOpen(false);

        setOrgOpen(false);

        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  /*
==============================
OUTSIDE CLICK HANDLER
==============================
*/

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }

      if (orgDropdownRef.current && !orgDropdownRef.current.contains(target)) {
        setOrgOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const toggleTheme = () => {
    setDarkMode((previous) => !previous);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleOrganizationChange = (org: any) => {
    setSelectedOrg(org);

    localStorage.setItem("selectedOrg", JSON.stringify(org));

    setOrgOpen(false);
  };

  const handleSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && searchQuery.trim()) {
      navigate(`/repositories?search=${searchQuery}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      {/* ==============================
    LEFT SIDE
================================ */}
      <div className="flex min-w-0 items-center gap-2">
        {/* MOBILE MENU */}

        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
          className={`${controlClass} md:hidden`}
        >
          <Menu size={18} />
        </button>

        {/* ORGANIZATION SWITCHER */}

        <div ref={orgDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setOrgOpen((previous) => !previous);

              setProfileOpen(false);

              setNotificationsOpen(false);
            }}
            className="flex h-9 items-center gap-2 rounded-md border border-border px-2.5 text-[13px] font-medium transition-colors hover:border-primary/40 hover:bg-accent"
          >
            {selectedOrg?.avatarUrl ? (
              <img
                src={selectedOrg.avatarUrl}
                alt={selectedOrg.login}
                className="h-5 w-5 rounded-sm object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary/15 text-primary">
                <Building2 size={12} />
              </span>
            )}

            <span className="max-w-[110px] truncate sm:max-w-[170px]">
              {selectedOrg?.name || selectedOrg?.login || "Select Org"}
            </span>

            <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
          </button>

          <AnimatePresence>
            {orgOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
              >
                <p className="eyebrow border-b border-border px-3 py-2 text-[10px]">
                  Organizations
                </p>

                <div className="max-h-64 overflow-y-auto p-1">
                  {orgs.length === 0 ? (
                    <p className="px-2.5 py-2 text-xs text-muted-foreground">
                      No organizations found
                    </p>
                  ) : (
                    orgs.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => handleOrganizationChange(org)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                          selectedOrg?.id === org.id
                            ? "bg-accent font-medium text-primary"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        }`}
                      >
                        {org.avatarUrl ? (
                          <img
                            src={org.avatarUrl}
                            alt=""
                            className="h-5 w-5 rounded-sm"
                          />
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

        {/* DESKTOP SEARCH */}

        <div className="hidden h-9 items-center gap-2 rounded-md border border-border px-2.5 transition-colors focus-within:border-primary/50 lg:flex lg:w-64">
          <Search size={15} className="shrink-0 text-muted-foreground" />

          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            type="text"
            placeholder="Search repositories..."
            className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
          />

          <kbd className="rounded-xs border border-border px-1 font-mono text-[10px] text-muted-foreground">
            /
          </kbd>
        </div>

        {/* MOBILE SEARCH BUTTON */}

        <button
          type="button"
          onClick={() => {
            setSearchOpen((previous) => !previous);
          }}
          aria-label="Open search"
          className={`${controlClass} lg:hidden`}
        >
          {searchOpen ? <X size={17} /> : <Search size={17} />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* THEME TOGGLE */}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className={controlClass}
        >
          <AnimatePresence mode="wait" initial={false}>
            {darkMode ? (
              <motion.span
                key="sun"
                initial={{ opacity: 0, rotate: -80 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 80 }}
                transition={{ duration: 0.15 }}
              >
                <Sun size={17} />
              </motion.span>
            ) : (
              <motion.span
                key="moon"
                initial={{ opacity: 0, rotate: 80 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -80 }}
                transition={{ duration: 0.15 }}
              >
                <Moon size={17} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* NOTIFICATIONS */}

        <div ref={notificationRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((previous) => !previous);

              setProfileOpen(false);
            }}
            aria-label="Notifications"
            className={`relative ${controlClass}`}
          >
            <NotificationIcon size={17} />

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 z-[9999] mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-[13px] font-semibold">Notifications</p>

                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {unreadCount} unread
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.put("/api/notifications/read-all");
                        setNotifications((previous) =>
                          previous.map((item) => ({
                            ...item,
                            unread: false,
                          })),
                        );
                      } catch (err) {
                        console.error("Failed to mark all as read", err);
                      }
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {loadingNotifications && (
                    <p className="p-4 text-xs text-muted-foreground">
                      Loading notifications...
                    </p>
                  )}

                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={async () => {
                        if (!notification.unread) return;
                        try {
                          await api.put(`/api/notifications/${notification.id}/read`);
                          setNotifications((previous) =>
                            previous.map((item) =>
                              item.id === notification.id ? { ...item, unread: false } : item
                            ),
                          );
                        } catch (err) {
                          console.error("Failed to mark notification as read", err);
                        }
                      }}
                      className={`flex gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-accent/50 ${
                        notification.unread ? "cursor-pointer" : ""
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          notification.unread ? "bg-primary" : "bg-border"
                        }`}
                      />

                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">
                          {notification.title}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {notification.description}
                        </p>

                        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate("/notifications");
                  }}
                  className="w-full py-2.5 text-center text-xs font-medium text-primary transition-colors hover:bg-accent/50"
                >
                  View all notifications
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PROFILE */}

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((previous) => !previous);

              setNotificationsOpen(false);
            }}
            className="flex h-9 items-center gap-2 rounded-md border border-border px-1.5 transition-colors hover:border-primary/40 hover:bg-accent sm:pr-2.5"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-6 w-6 rounded-sm object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
                {user.initials}
              </span>
            )}

            <span className="hidden text-[13px] font-medium sm:block">
              {user.name}
            </span>

            <ChevronDown size={13} className="hidden text-muted-foreground sm:block" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
              >
                <div className="border-b border-border px-3 py-3">
                  <p className="text-[13px] font-semibold">{user.name}</p>

                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    @{user.username} · {user.role.toLowerCase()}
                  </p>
                </div>

                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => navigate("/settings")}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <UserIcon size={15} />
                    Profile
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MOBILE SEARCH PANEL */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute left-0 right-0 top-14 overflow-hidden border-b border-border bg-background px-4 py-3 lg:hidden"
          >
            <div className="flex h-9 items-center gap-2 rounded-md border border-border px-2.5">
              <Search size={15} className="text-muted-foreground" />

              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                type="text"
                placeholder="Search repositories..."
                className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
