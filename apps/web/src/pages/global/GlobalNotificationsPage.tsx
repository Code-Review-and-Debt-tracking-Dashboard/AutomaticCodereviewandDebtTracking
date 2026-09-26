import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";

import {
  AlertIcon,
  CheckIcon,
  NotificationIcon,
  QualityGateIcon,
} from "../../components/icons";

import { api } from "../../lib/apiClient";
import { apiErrorMessage } from "../../lib/apiError";

import {
  Card,
  Button,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
  Select,
  TabGroup,
  NotificationItem,
  EmptyState,
} from "../../components/ui";


interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  repository: { id: string; name: string } | null;
}

const severityByType: Record<string, "critical" | "high"> = {
  CRITICAL_FINDING: "critical",
  QUALITY_GATE_FAILED: "high",
  SCORE_DROPPED: "high",
  ANALYSIS_FAILED: "high",
};

function getNotificationIcon(type: string) {
  if (type === "CRITICAL_FINDING")
    return { icon: AlertIcon, color: "bg-destructive/10 text-destructive" };
  if (type === "QUALITY_GATE_FAILED")
    return { icon: QualityGateIcon, color: "bg-warning/10 text-warning" };
  if (type === "SCORE_DROPPED" || type === "ANALYSIS_FAILED")
    return { icon: AlertIcon, color: "bg-warning/10 text-warning" };
  if (type.startsWith("ANALYSIS_"))
    return { icon: CheckIcon, color: "bg-success/10 text-success" };
  return { icon: NotificationIcon, color: "bg-muted text-muted-foreground" };
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


export function GlobalNotificationsPage() {
  const navigate = useNavigate();
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
        setNotifications(response.data || []);
      } catch (err: any) {
        setError(apiErrorMessage(err, "Failed to load notifications."));
        setNotifications([]);
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
      if (activeTab === "critical" && severityByType[n.type] !== "critical") return false;
      if (repoFilter !== "All" && n.repository?.name !== repoFilter) return false;
      // "ANALYSIS" matches started, completed and failed
      if (typeFilter !== "All" && !n.type.startsWith(typeFilter)) return false;
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
  const criticalCount = notifications.filter((n) => severityByType[n.type] === "critical").length;

  /* Repos for filter */
  const repoOptions = useMemo(() => {
    const repos = new Set(notifications.map((n) => n.repository?.name).filter(Boolean));
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

  const markOneRead = async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
    } catch { /* continue with local state */ }
    setNotifications((curr) =>
      curr.map((n) =>
        n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n
      )
    );
  };

  const openNotification = (n: NotificationData) => {
    if (!n.readAt) markOneRead(n.id);
    if (!n.repository) return;
    const toFindings = n.type === "CRITICAL_FINDING" || n.type === "QUALITY_GATE_FAILED";
    navigate(`/repositories/${n.repository.id}${toFindings ? "/findings" : ""}`);
  };

  const deleteOne = (id: string) => {
    setNotifications((curr) => curr.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };


  return (
    <>

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
              { label: "Analysis", value: "ANALYSIS" },
              { label: "Quality Gate", value: "QUALITY_GATE_FAILED" },
              { label: "Score Drop", value: "SCORE_DROPPED" },
              { label: "Critical Finding", value: "CRITICAL_FINDING" },
              { label: "Member Added", value: "MEMBER_ADDED" },
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
          icon={NotificationIcon}
          title={notifications.length === 0 ? "No notifications" : "Nothing matches these filters"}
          description={
            notifications.length === 0
              ? "You are alerted when a quality gate fails, a health score drops sharply, or a new critical vulnerability appears. A healthy repository stays quiet."
              : "Try a different tab, repository, or type."
          }
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
                  const { icon, color } = getNotificationIcon(n.type);

                  return (
                    <NotificationItem
                      key={n.id}
                      icon={icon}
                      iconColor={color}
                      title={n.title}
                      description={n.body}
                      time={timeAgo(n.createdAt)}
                      repoName={n.repository?.name}
                      unread={!n.readAt}
                      severity={severityByType[n.type]}
                      onClick={() => openNotification(n)}
                      onMarkRead={() => markOneRead(n.id)}
                      onDelete={() => deleteOne(n.id)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

    </>
  );
}
