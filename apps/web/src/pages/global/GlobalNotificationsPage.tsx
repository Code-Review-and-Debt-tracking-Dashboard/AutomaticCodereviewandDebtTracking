import { useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { api } from "../../lib/apiClient";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function GlobalNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<{ data: NotificationItem[] }>("/api/notifications");
        setNotifications(response.data || []);
      } catch (fetchError: any) {
        setError(fetchError?.response?.data?.error?.message || "Failed to load notifications.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    await api.put("/api/notifications/read-all");
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Notifications
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Track analysis events, gate failures, and score changes.
            </p>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-primary/40 hover:bg-muted"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="mt-8 flex items-center justify-center rounded-2xl border border-border/70 bg-card p-12 text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading notifications…
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-12 text-center">
            <Bell size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No notifications yet.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-2xl border p-5 ${notification.readAt ? "border-border/70 bg-card" : "border-primary/20 bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{notification.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{notification.body}</p>
                  </div>
                  {!notification.readAt && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Unread
                    </span>
                  )}
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
        </div>
    </main>
  );
}
