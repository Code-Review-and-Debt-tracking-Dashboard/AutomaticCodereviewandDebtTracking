import { Platform } from 'react-native';

// colors copied from the web, hex so screens can add alpha like `${c.danger}20`

function hsl(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

export interface ThemeColors {
  bg: string;
  card: string;
  muted: string;
  border: string;
  divider: string;
  textPrimary: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  link: string;
  success: string;
  info: string;
  warning: string;
  danger: string;
  purple: string;
  white: string;
  tabBar: string;
}

// LIGHT — editorial paper
export const lightColors: ThemeColors = {
  bg: hsl(48, 31, 94),
  card: hsl(48, 40, 98),
  muted: hsl(48, 24, 91),
  border: hsl(44, 18, 84),
  divider: hsl(44, 18, 88),
  textPrimary: hsl(156, 30, 12),
  text: hsl(156, 18, 22),
  textMuted: hsl(150, 10, 38),
  primary: hsl(156, 58, 28),
  primaryForeground: hsl(48, 40, 98),
  accent: hsl(156, 30, 88),
  accentForeground: hsl(156, 58, 25),
  link: hsl(156, 58, 28),
  success: hsl(156, 55, 31),
  info: hsl(196, 58, 34),
  warning: hsl(32, 78, 38),
  danger: hsl(4, 64, 45),
  // darker than the web so it shows on light bg
  purple: '#7C5CD6',
  white: '#FFFFFF',
  tabBar: hsl(48, 28, 92),
};

// DARK — instrument panel
export const darkColors: ThemeColors = {
  bg: hsl(214, 24, 7),
  card: hsl(214, 20, 10),
  muted: hsl(214, 14, 14),
  border: hsl(214, 14, 19),
  divider: hsl(214, 14, 16),
  textPrimary: hsl(214, 16, 93),
  text: hsl(214, 12, 80),
  textMuted: hsl(214, 10, 62),
  primary: hsl(156, 62, 50),
  primaryForeground: hsl(214, 30, 8),
  accent: hsl(214, 16, 17),
  accentForeground: hsl(156, 62, 62),
  link: hsl(156, 62, 62),
  success: hsl(156, 58, 48),
  info: hsl(190, 68, 56),
  warning: hsl(38, 92, 58),
  danger: hsl(4, 78, 64),
  purple: '#A78BFA',
  white: '#FFFFFF',
  tabBar: hsl(214, 26, 5),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 3,
  md: 5,
  lg: 7,
  xl: 9,
} as const;

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

// same bands as the web
export function healthBand(score: number | null | undefined, c: ThemeColors) {
  if (score === null || score === undefined) return { label: 'Not analyzed', color: c.textMuted };
  if (score >= 90) return { label: 'Excellent', color: c.success };
  if (score >= 70) return { label: 'Good', color: c.info };
  if (score >= 50) return { label: 'Fair', color: c.warning };
  if (score >= 25) return { label: 'Poor', color: c.danger };
  return { label: 'Critical', color: c.danger };
}
