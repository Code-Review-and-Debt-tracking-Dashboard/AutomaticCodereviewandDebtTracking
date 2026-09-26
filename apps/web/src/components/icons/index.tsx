import type { ReactNode } from "react";

// 20px grid icons, same props as lucide

interface IconProps {
  size?: number;
  className?: string;
}

function Icon({
  size = 20,
  className = "",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function OverviewIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 2.75 H8.25 V17.25 H2.75 Z" />
      <path d="M11.75 2.75 H17.25 V8 H11.75 Z" />
      <path d="M11.75 12 H17.25 V17.25 H11.75 Z" />
      <circle cx="14.5" cy="14.6" r="1.15" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function RepositoriesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 L17.5 6.75 L10 11 L2.5 6.75 Z" />
      <path d="M2.5 11.25 L10 15.5 L17.5 11.25" />
      <circle cx="10" cy="6.75" r="1.25" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function PullRequestIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 4.5 V15" />
      <path d="M5.5 6.25 H12 L14.5 8.75 V15" />
      <circle cx="14.5" cy="16.25" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="16.25" r="1.5" />
    </Icon>
  );
}

export function FindingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 L16.5 5.25 V10 L10 17.5 L3.5 10 V5.25 Z" />
      <path d="M10 7 V10.5" />
      <circle cx="10" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 16.75 H17" />
      <path d="M6 16.75 V11" />
      <path d="M10 16.75 V7.5" />
      <path d="M14 16.75 V13" />
      <circle cx="10" cy="4.75" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function NotificationIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.25 14.25 L6 12.25 V8.5 L10 4.25 L14 8.5 V12.25 L15.75 14.25 Z" />
      <circle cx="10" cy="16.5" r="1.3" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function MembersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 4.25 L9.75 6.5 L7.5 8.75 L5.25 6.5 Z" />
      <path d="M2.75 16 V13.75 L7.5 10.75 L12.25 13.75 V16" />
      <path d="M14 16 V13.25 L16.75 11.5" />
      <circle cx="14.75" cy="6.75" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 5.75 H17" />
      <path d="M3 10 H17" />
      <path d="M3 14.25 H17" />
      <path d="M13 4.25 V7.25" />
      <path d="M7 8.5 V11.5" />
      <circle cx="11" cy="14.25" r="1.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function HealthIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 10 H5.75 L7.75 5 L10.75 15 L12.75 10 H15.5" />
      <circle cx="17.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function DebtIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3 H15 L10 10 L15 17 H5 L10 10 Z" />
      <circle cx="10" cy="13.75" r="1.15" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function HotspotIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 L17.5 10 L10 17.5 L2.5 10 Z" />
      <path d="M10 6.25 L13.75 10 L10 13.75 L6.25 10 Z" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function QualityGateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 3.5 V16.5" />
      <path d="M16 3.5 V16.5" />
      <path d="M4 7.5 H16" />
      <path d="M7 12 L9.25 14.25 L13.5 9.5" />
      <circle cx="10" cy="5.5" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function TrendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 15.5 L7 11 L10.5 13.5 L17 6" />
      <path d="M12.5 5.5 H17.5 V10.5" />
      <circle cx="7" cy="11" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function FilesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 2.5 H12 L15.5 6 V17.5 H4.5 Z" />
      <path d="M11.75 2.75 V6.25 H15.25" />
      <path d="M8.5 10.5 H13" />
      <path d="M8.5 13.5 H11.5" />
      <circle cx="6.75" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6.75" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3 L17.5 16.5 H2.5 Z" />
      <path d="M10 8 V11.5" />
      <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 10.25 L8 14.75 L16.5 5.5" />
      <circle cx="3.5" cy="10.25" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.5 L17.5 10 L10 17.5 L2.5 10 Z" />
      <path d="M10 6 V10 H13" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

// used by empty states
export function FlatlineIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      width="132"
      height="40"
      viewBox="0 0 132 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M0 20 H52 L57 20 L61 14 L65 26 L69 20 H132"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.35"
      />
      <circle cx="66" cy="20" r="2.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
