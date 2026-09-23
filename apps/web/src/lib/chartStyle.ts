/*
 * Shared recharts styling so every chart in the app reads the same:
 * mono tick labels, hairline grid, tokens only — no hard-coded colours.
 */

export const CHART_TICK = {
  fill: "hsl(var(--muted-foreground))",
  fontSize: 11,
  fontFamily: "var(--font-code)",
};

export const CHART_TOOLTIP = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "7px",
  fontSize: "12px",
  fontFamily: "var(--font-code)",
  color: "hsl(var(--foreground))",
  boxShadow: "none",
};

export const CHART_CURSOR = {
  stroke: "hsl(var(--primary))",
  strokeWidth: 1,
  strokeDasharray: "3 3",
};

export const CHART_GRID = "hsl(var(--border))";
