export interface TrendCounts {
  healthScore: number;
  totalIssues?: number;
  vulnerabilityCount?: number;
  complexityCount?: number;
  duplicationPct?: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

// what moved between two analyses, e.g. ["score −6.2", "+3 vulnerabilities"]
export function describeChange(prev: TrendCounts, curr: TrendCounts): string[] {
  const parts: string[] = [];

  const score = round1(curr.healthScore - prev.healthScore);
  if (score !== 0) parts.push(`score ${signed(score)}`);

  const counts: [keyof TrendCounts, string][] = [
    ["totalIssues", "findings"],
    ["vulnerabilityCount", "vulnerabilities"],
    ["complexityCount", "complexity"],
  ];
  for (const [key, label] of counts) {
    const diff = (curr[key] ?? 0) - (prev[key] ?? 0);
    if (diff !== 0) parts.push(`${signed(diff)} ${label}`);
  }

  const duplication = round1((curr.duplicationPct ?? 0) - (prev.duplicationPct ?? 0));
  if (duplication !== 0) parts.push(`${signed(duplication)}% duplication`);

  return parts;
}
