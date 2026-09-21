/**
 * Shared design tokens for the mobile app.
 *
 * Colors match the GitHub-dark palette already used by HomeScreen and
 * RepoSummaryScreen. New code should reference these instead of hardcoding hex.
 */
export const colors = {
  bg: '#0D1117',
  card: '#161B22',
  border: '#30363D',
  divider: '#21262D',
  textPrimary: '#F0F6FC',
  text: '#C9D1D9',
  textMuted: '#8B949E',
  link: '#58A6FF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#A78BFA',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
} as const;
