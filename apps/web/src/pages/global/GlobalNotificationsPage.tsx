import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  GitPullRequest,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { api } from "../../lib/apiClient";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  NotificationItem,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  Select,
  TabGroup,
} from "../../components/ui";


/* =========================================================
   TYPES
========================================================= */

interface NotificationData {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  repoName?: string;
  severity?: "critical" | "high" | "medium" | "low";
  type?: string;
}


/* =========================================================
   DEMO DATA (fallback when API is unavailable)
========================================================= */

const demoNotifications: NotificationData[] = [
  {
    id: "n-001",
    title: "Analysis completed successfully",
    body: "AutomaticCodeReview repository static scan finished with a health score of 86 (+4).",
    readAt: null,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    repoName: "AutomaticCodeReview",
    type: "analysis",
  },
  {
    id: "n-002",
    title: "Critical vulnerability detected",
    body: "High risk SQL injection vulnerability found in src/api/users.ts:42",
    readAt: null,
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    repoName: "AutomaticCodeReview",
    severity: "critical",
    type: "security",
  },
  {
    id: "n-003",
    title: "Pull request passed quality gate",
    body: "PR #42 'Add repository health scoring' passed all strict gate checks.",
    readAt: null,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    repoName: "AutomaticCodeReview",
    type: "quality-gate",
  },
  {
    id: "n-004",
    title: "High complexity function warning",
    body: "Function processAsPayload in MobileDashboard exceeds the recommended complexity threshold.",
    readAt: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    repoName: "MobileDashboard",
    severity: "high",
    type: "analysis",
  },
  {
    id: "n-005",
    title: "Pull request analyzed",
    body: "PR #41 'Fix login redirect bug' scanned — 2 new findings, 4 fixed.",
    readAt: "2026-01-01T00:00:00Z",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    repoName: "AutomaticCodeReview",
    type: "pr-scan",
  },
  {
    id: "n-006",
    title: "Analysis completed successfully",
    body: "AnalysisWorker repository static scan finished with a health score of 91 (+1).",
    readAt: "2026-01-01T00:00:00Z",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    repoName: "AnalysisWorker",
    type: "analysis",
  },
];


/* =========================================================
   ICON MAPPING
========================================================= */

function getNotificationIcon(n: NotificationData) {
  if (n.severity === "critical" || n.severity === "high")
    return { icon: AlertTriangle, color: "bg-warning/10 text-warning" };
  if (n.type === "quality-gate" || n.type === "analysis")
    return { icon: CheckCircle2, color: "bg-success/10 text-success" };
  if (n.type === "pr-scan")
    return { icon: GitPullRequest, color: "bg-info/10 text-info" };
  if (n.type === "security")
    return { icon: ShieldCheck, color: "bg-destructive/10 text-destructive" };
  return { icon: Bell, color: "bg-muted text-muted-foreground" };
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}


/* =========================================================
   COMPONENT
========================================================= */

export function GlobalNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Filters */
  const [activeTab, setActiveTab] = useState("all");
  const [repoFilter, setRepoFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");


  /* Fetch Notifications */
  useEffect(() => {
    const fetchNotifications = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<{ data: NotificationData[] }>("/api/notifications");
        const data = response.data || [];
        setNotifications(data.length > 0 ? data : demoNotifications);
      } catch {
        setNotifications(demoNotifications);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, []);


  /* Filter logic */
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === "unread" && n.readAt) return false;
      if (activeTab === "critical" && n.severity !== "critical") return false;
      if (repoFilter !== "All" && n.repoName !== repoFilter) return false;
      if (typeFilter !== "All" && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, activeTab, repoFilter, typeFilter]);


  /* Group by date */
  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { label: string; items: NotificationData[] }[] = [];
    const todayItems: NotificationData[] = [];
    const yesterdayItems: NotificationData[] = [];
    const earlierItems: NotificationData[] = [];

    for (const n of filteredNotifications) {
      const d = new Date(n.createdAt);
      if (d >= today) todayItems.push(n);
      else if (d >= yesterday) yesterdayItems.push(n);
      else earlierItems.push(n);
    }

    if (todayItems.length > 0) groups.push({ label: "TODAY", items: todayItems });
    if (yesterdayItems.length > 0) groups.push({ label: "YESTERDAY", items: yesterdayItems });
    if (earlierItems.length > 0) groups.push({ label: "EARLIER", items: earlierItems });

    return groups;
  }, [filteredNotifications]);


  /* Counts */
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const criticalCount = notifications.filter((n) => n.severity === "critical").length;

  /* Repos for filter */
  const repoOptions = useMemo(() => {
    const repos = new Set(notifications.map((n) => n.repoName).filter(Boolean));
    return [
      { label: "Repository: All", value: "All" },
      ...[...repos].map((r) => ({ label: r!, value: r! })),
    ];
  }, [notifications]);


  /* Actions */
  const markAllRead = async () => {
    try {
      await api.put("/api/notifications/read-all");
    } catch { /* continue with local state */ }
    setNotifications((curr) =>
      curr.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );
  };

  const markOneRead = (id: string) => {
    setNotifications((curr) =>
      curr.map((n) =>
        n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n
      )
    );
  };

  const deleteOne = (id: string) => {
    setNotifications((curr) => curr.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };


  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <PageHeader>
          <div>
            <PageHeaderTitle>Notifications</PageHeaderTitle>
            <PageHeaderDescription>
              Real-time updates regarding analysis builds, quality gate triggers, and security alerts.
            </PageHeaderDescription>
          </div>

          <PageHeaderActions>
            <Button variant="secondary" onClick={markAllRead}>
              <CheckCircle2 size={16} />
              Mark all as read
            </Button>
            <Button variant="destructive" onClick={clearAll}>
              <Trash2 size={16} />
              Clear all
            </Button>
          </PageHeaderActions>
        </PageHeader>


        {/* Tabs + Filters Row */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabGroup
            tabs={[
              { id: "all", label: "All", count: totalCount },
              { id: "unread", label: "Unread", count: unreadCount },
              { id: "critical", label: "Critical", count: criticalCount },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="flex items-center gap-2">
            <Select
              value={repoFilter}
              onChange={setRepoFilter}
              options={repoOptions}
            />
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: "Type: All", value: "All" },
                { label: "Analysis", value: "analysis" },
                { label: "Security", value: "security" },
                { label: "PR Scan", value: "pr-scan" },
                { label: "Quality Gate", value: "quality-gate" },
              ]}
            />
          </div>
        </div>


        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}


        {/* Content */}
        {isLoading ? (
          <Card className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading notifications…
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You're all caught up! New notifications will appear here."
          />
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>

                <div className="space-y-3">
                  {group.items.map((n) => {
                    const { icon, color } = getNotificationIcon(n);

                    return (
                      <NotificationItem
                        key={n.id}
                        icon={icon}
                        iconColor={color}
                        title={n.title}
                        description={n.body}
                        time={timeAgo(n.createdAt)}
                        repoName={n.repoName}
                        unread={!n.readAt}
                        severity={n.severity}
                        onMarkRead={() => markOneRead(n.id)}
                        onDelete={() => deleteOne(n.id)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Load Earlier */}
            <div className="pt-2 text-center">
              <button className="text-xs font-medium text-primary hover:underline">
                Load 6 earlier notifications
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
