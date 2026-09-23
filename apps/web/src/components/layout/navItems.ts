import type { ComponentType } from "react";

import {
  AnalyticsIcon,
  FindingsIcon,
  MembersIcon,
  NotificationIcon,
  OverviewIcon,
  PullRequestIcon,
  RepositoriesIcon,
  SettingsIcon,
} from "../icons";

export interface NavItem {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  path: string;
}

export const workspaceItems: NavItem[] = [
  { label: "Overview", icon: OverviewIcon, path: "/dashboard" },
  { label: "Repositories", icon: RepositoriesIcon, path: "/repositories" },
  { label: "Pull Requests", icon: PullRequestIcon, path: "/pull-requests" },
  { label: "Findings", icon: FindingsIcon, path: "/findings" },
  { label: "Analytics", icon: AnalyticsIcon, path: "/analytics" },
];

export const managementItems: NavItem[] = [
  { label: "Notifications", icon: NotificationIcon, path: "/notifications" },
  { label: "Members", icon: MembersIcon, path: "/members" },
  { label: "Settings", icon: SettingsIcon, path: "/settings" },
];
