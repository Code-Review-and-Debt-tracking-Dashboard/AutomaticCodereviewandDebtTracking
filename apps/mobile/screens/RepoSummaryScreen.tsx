import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api } from '../lib/apiClient';
import type { HomeStackParamList } from '../navigation/TabNavigator';

type Props = NativeStackScreenProps<HomeStackParamList, 'RepoSummary'>;

interface RepoDetail {
  healthScore: number;
  openFindings: number;
  debtMinutes: number;
  lastAnalyzedAt: string | null;
}

interface TrendPoint {
  date: string;
  healthScore: number;
}

type DebtCategory = 'vulnerability' | 'complexity' | 'duplication' | 'code_smell' | 'maintainability';

interface RepoDebt {
  totalDebtMinutes: number;
  debtDelta: number;
  breakdown: Record<DebtCategory, { count: number; debtMinutes: number }>;
}

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

interface Smell {
  file: string;
  line: number;
  severity: Severity;
  rule: string;
  message: string;
  isNew: boolean;
}

interface RepoSmells {
  smells: Smell[];
  totalSmells: number;
}

const CATEGORIES: { key: DebtCategory; label: string; color: string }[] = [
  { key: 'vulnerability', label: 'Vulnerability', color: '#EF4444' },
  { key: 'complexity', label: 'Complexity', color: '#58A6FF' },
  { key: 'duplication', label: 'Duplication', color: '#F59E0B' },
  { key: 'code_smell', label: 'Code Smell', color: '#A78BFA' },
  { key: 'maintainability', label: 'Maintainability', color: '#10B981' },
];

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: '#EF4444',
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#8B949E',
  INFO: '#8B949E',
};

const TOP_ISSUES_LIMIT = 5;

const scoreColor = (score: number) =>
  score >= 85 ? '#10B981' : score >= 70 ? '#F59E0B' : '#EF4444';

const formatDebt = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Step 109 (E-06): Mobile repo summary screen — gauge, trend, category bars, top issues
 */
export default function RepoSummaryScreen({ route }: Props) {
  const { repoId } = route.params;

  const [detail, setDetail] = useState<RepoDetail | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [debt, setDebt] = useState<RepoDebt | null>(null);
  const [smells, setSmells] = useState<RepoSmells | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [detailRes, trendRes, debtRes, smellsRes] = await Promise.allSettled([
        api.get<RepoDetail>(`/api/repos/${repoId}`),
        api.get<{ dataPoints: TrendPoint[] }>(`/api/repos/${repoId}/trend?days=30`),
        api.get<RepoDebt>(`/api/repos/${repoId}/debt`),
        api.get<RepoSmells>(`/api/mobile/repos/${repoId}/smells?limit=${TOP_ISSUES_LIMIT}`),
      ]);

      if (detailRes.status === 'rejected') {
        setError('Could not load repository.');
        return;
      }

      setDetail(detailRes.value);
      setTrend(trendRes.status === 'fulfilled' ? trendRes.value.dataPoints : []);
      setDebt(debtRes.status === 'fulfilled' ? debtRes.value : null);
      setSmells(smellsRes.status === 'fulfilled' ? smellsRes.value : null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, [repoId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{error ?? 'Something went wrong.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void fetchSummary()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const color = scoreColor(detail.healthScore);
  const delta =
    trend.length >= 2
      ? Math.round(trend[trend.length - 1].healthScore - trend[trend.length - 2].healthScore)
      : 0;
  const deltaColor = delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : '#8B949E';
  const deltaLabel = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '— no change';

  const trendScores = trend.map((p) => p.healthScore);
  const trendMin = Math.min(...trendScores);
  const trendMax = Math.max(...trendScores);
  const trendRange = trendMax - trendMin || 1;

  const maxCategoryMinutes = debt
    ? Math.max(...CATEGORIES.map((c) => debt.breakdown[c.key]?.debtMinutes ?? 0))
    : 0;
  const hasBreakdown = maxCategoryMinutes > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void fetchSummary(true)} tintColor="#10B981" />
      }
    >
      {/* Gauge */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Score</Text>
        <View style={styles.gaugeRow}>
          <View style={[styles.gaugeRing, { borderColor: color, backgroundColor: `${color}15` }]}>
            <Text style={[styles.gaugeScore, { color }]}>{Math.round(detail.healthScore)}</Text>
            <Text style={styles.gaugeOutOf}>/ 100</Text>
          </View>
          <View style={styles.gaugeMeta}>
            <Text style={[styles.deltaText, { color: deltaColor }]}>{deltaLabel}</Text>
            <Text style={styles.metaLabel}>vs previous scan</Text>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Tech Debt</Text>
              <Text style={styles.metaValue}>{formatDebt(detail.debtMinutes)}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Open Findings</Text>
              <Text style={styles.metaValue}>{detail.openFindings}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.footnote}>
          {detail.lastAnalyzedAt
            ? `Last analyzed ${new Date(detail.lastAnalyzedAt).toLocaleString()}`
            : 'Not analyzed yet'}
        </Text>
      </View>

      {/* Trend */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>30d Trend</Text>
        {trend.length === 0 ? (
          <Text style={styles.emptyText}>No scans in the last 30 days.</Text>
        ) : (
          <>
            <View style={styles.trendChart}>
              {trend.map((point, idx) => {
                const heightPct = Math.max(10, ((point.healthScore - trendMin) / trendRange) * 100);
                const isUp = idx > 0 && point.healthScore >= trend[idx - 1].healthScore;
                return (
                  <View
                    key={point.date + idx}
                    style={[
                      styles.trendBar,
                      { height: `${heightPct}%`, backgroundColor: isUp ? '#10B981' : '#F59E0B' },
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.trendAxis}>
              <Text style={styles.axisText}>{formatDate(trend[0].date)}</Text>
              <Text style={styles.axisText}>
                {trendMin} – {trendMax}
              </Text>
              <Text style={styles.axisText}>{formatDate(trend[trend.length - 1].date)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Category bars */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Debt by Category</Text>
        {!debt || !hasBreakdown ? (
          <Text style={styles.emptyText}>No debt breakdown available.</Text>
        ) : (
          <>
            {CATEGORIES.map((cat) => {
              const entry = debt.breakdown[cat.key] ?? { count: 0, debtMinutes: 0 };
              const widthPct = (entry.debtMinutes / maxCategoryMinutes) * 100;
              return (
                <View key={cat.key} style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                    <Text style={styles.categoryValue}>
                      {entry.count} · {formatDebt(entry.debtMinutes)}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: cat.color }]} />
                  </View>
                </View>
              );
            })}
            <View style={styles.totalRow}>
              <Text style={styles.metaLabel}>Total</Text>
              <Text style={styles.metaValue}>{formatDebt(debt.totalDebtMinutes)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Top issues */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top Issues</Text>
        {!smells || smells.smells.length === 0 ? (
          <Text style={styles.emptyText}>No issues found.</Text>
        ) : (
          <>
            {smells.smells.map((smell, idx) => {
              const sevColor = SEVERITY_COLORS[smell.severity] ?? '#8B949E';
              return (
                <View key={`${smell.file}-${smell.line}-${idx}`} style={styles.issueRow}>
                  <View style={styles.issueHeader}>
                    <View style={[styles.severityPill, { backgroundColor: `${sevColor}20` }]}>
                      <Text style={[styles.severityText, { color: sevColor }]}>{smell.severity}</Text>
                    </View>
                    {smell.isNew && (
                      <View style={styles.newPill}>
                        <Text style={styles.newText}>NEW</Text>
                      </View>
                    )}
                    <Text style={styles.issueRule} numberOfLines={1}>
                      {smell.rule}
                    </Text>
                  </View>
                  <Text style={styles.issueFile} numberOfLines={1}>
                    {smell.file}:{smell.line}
                  </Text>
                  <Text style={styles.issueMessage} numberOfLines={2}>
                    {smell.message}
                  </Text>
                </View>
              );
            })}
            <Text style={styles.footnote}>
              Showing {smells.smells.length} of {smells.totalSmells}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1117',
    gap: 12,
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B949E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#8B949E',
  },
  footnote: {
    fontSize: 11,
    color: '#8B949E',
    marginTop: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#21262D',
  },
  retryText: {
    color: '#58A6FF',
    fontWeight: '600',
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  gaugeRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: 34,
    fontWeight: '800',
  },
  gaugeOutOf: {
    fontSize: 11,
    color: '#8B949E',
    marginTop: -2,
  },
  gaugeMeta: {
    flex: 1,
    gap: 2,
  },
  deltaText: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaBlock: {
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 11,
    color: '#8B949E',
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C9D1D9',
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 3,
  },
  trendBar: {
    flex: 1,
    borderRadius: 2,
  },
  trendAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisText: {
    fontSize: 10,
    color: '#8B949E',
  },
  categoryRow: {
    marginBottom: 10,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#C9D1D9',
  },
  categoryValue: {
    fontSize: 12,
    color: '#8B949E',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#21262D',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#21262D',
  },
  issueRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
    gap: 3,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  newPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#58A6FF20',
  },
  newText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#58A6FF',
  },
  issueRule: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#C9D1D9',
  },
  issueFile: {
    fontSize: 12,
    color: '#58A6FF',
  },
  issueMessage: {
    fontSize: 12,
    color: '#8B949E',
  },
});
