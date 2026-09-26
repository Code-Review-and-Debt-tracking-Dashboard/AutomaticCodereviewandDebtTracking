import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api } from '../lib/apiClient';
import { useAsyncData } from '../hooks/useAsyncData';
import { useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { Card, ErrorState, LoadingState } from '../components';
import { ScreenTour } from '../components/ScreenTour';
import { fonts, healthBand, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/TabNavigator';

type Props = NativeStackScreenProps<HomeStackParamList, 'RepoSummary'>;

interface RepoDetail {
  healthScore: number | null;
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

interface RepoSummaryData {
  detail: RepoDetail;
  trend: TrendPoint[];
  debt: RepoDebt | null;
  smells: RepoSmells | null;
}

// Same series colors as the web's RepositoryOverviewPage donut.
const CATEGORIES: { key: DebtCategory; label: string; color: (c: ThemeColors) => string }[] = [
  { key: 'vulnerability', label: 'Vulnerability', color: (c) => c.danger },
  { key: 'complexity', label: 'Complexity', color: (c) => c.info },
  { key: 'duplication', label: 'Duplication', color: (c) => c.warning },
  { key: 'code_smell', label: 'Code Smell', color: (c) => c.purple },
  { key: 'maintainability', label: 'Maintainability', color: (c) => c.success },
];

const severityColor = (severity: Severity, c: ThemeColors) =>
  severity === 'CRITICAL' || severity === 'HIGH'
    ? c.danger
    : severity === 'MEDIUM'
    ? c.warning
    : c.textMuted;

const TOP_ISSUES_LIMIT = 5;
const MORE_ISSUES_PAGE = 10;
// Start fetching the next page of issues this many px before the bottom.
const LOAD_MORE_THRESHOLD = 200;

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
  const gaugeRef = useRef<View>(null);
  const trendRef = useRef<View>(null);
  const { repoId } = route.params;
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // State lags a render behind, so fast scroll events need a ref to avoid double-fetching a page.
  const loadingMoreRef = useRef(false);

  const { data, loading, refreshing, error, load, setData } = useAsyncData<RepoSummaryData>(async () => {
    const [detailRes, trendRes, debtRes, smellsRes] = await Promise.allSettled([
      api.get<RepoDetail>(`/api/repos/${repoId}`),
      api.get<{ dataPoints: TrendPoint[] }>(`/api/repos/${repoId}/trend?days=30`),
      api.get<RepoDebt>(`/api/repos/${repoId}/debt`),
      api.get<RepoSmells>(`/api/mobile/repos/${repoId}/smells?limit=${TOP_ISSUES_LIMIT}`),
    ]);

    // The detail call is required; the rest degrade to an empty section.
    if (detailRes.status === 'rejected') throw detailRes.reason;

    return {
      detail: detailRes.value,
      trend: trendRes.status === 'fulfilled' ? trendRes.value.dataPoints : [],
      debt: debtRes.status === 'fulfilled' ? debtRes.value : null,
      smells: smellsRes.status === 'fulfilled' ? smellsRes.value : null,
    };
  }, [repoId]);

  const loadMoreIssues = async () => {
    const current = data?.smells;
    if (!current || current.smells.length >= current.totalSmells) return;
    if (loadingMoreRef.current || refreshing) return;

    const offset = current.smells.length;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const page = await api.get<RepoSmells>(
        `/api/mobile/repos/${repoId}/smells?limit=${MORE_ISSUES_PAGE}&offset=${offset}`,
      );
      setData((prev) => {
        // A pull-to-refresh replaced the list meanwhile, so this page no longer lines up.
        if (!prev?.smells || prev.smells.smells.length !== offset) return prev;
        return {
          ...prev,
          smells: { smells: [...prev.smells.smells, ...page.smells], totalSmells: page.totalSmells },
        };
      });
    } catch {
      setLoadMoreFailed(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    // After a failure, wait for Retry rather than re-firing on every scroll event.
    if (loadMoreFailed) return;
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_MORE_THRESHOLD) {
      void loadMoreIssues();
    }
  };

  const refresh = () => {
    setLoadMoreFailed(false);
    void load(true);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!data) {
    return (
      <ErrorState
        title="Could not load repository"
        message={error ?? undefined}
        onRetry={() => void load()}
        retrying={loading}
      />
    );
  }

  const { detail, trend, debt, smells } = data;

  const band = healthBand(detail.healthScore, colors);
  const color = band.color;
  const delta =
    trend.length >= 2
      ? Math.round(trend[trend.length - 1].healthScore - trend[trend.length - 2].healthScore)
      : 0;
  const deltaColor = delta > 0 ? colors.success : delta < 0 ? colors.danger : colors.textMuted;
  const deltaLabel = delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '— no change';

  const trendScores = trend.map((p) => p.healthScore);
  const trendMin = Math.min(...trendScores);
  const trendMax = Math.max(...trendScores);
  const trendRange = trendMax - trendMin || 1;

  const maxCategoryMinutes = debt
    ? Math.max(...CATEGORIES.map((c) => debt.breakdown[c.key]?.debtMinutes ?? 0))
    : 0;
  const hasBreakdown = maxCategoryMinutes > 0;

  // tour sits beside the ScrollView so it doesn't scroll with the content
  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={100}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.card}
        />
      }
    >
      {/* Refresh failed, but the data already on screen is still usable */}
      {error ? (
        <ErrorState compact message={error} onRetry={refresh} retrying={refreshing} />
      ) : null}

      {/* Gauge */}
      <Card ref={gaugeRef} title="Health Score">
        <View style={styles.gaugeRow}>
          <View style={[styles.gaugeRing, { borderColor: color, backgroundColor: `${color}15` }]}>
            <Text style={[styles.gaugeScore, { color }]}>
              {detail.healthScore === null ? '—' : Math.round(detail.healthScore)}
            </Text>
            <Text style={styles.gaugeOutOf}>/ 100</Text>
            <Text style={[styles.gaugeBand, { color }]}>{band.label}</Text>
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
      </Card>

      {/* Trend */}
      <Card ref={trendRef} title="30d Trend">
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
                      { height: `${heightPct}%`, backgroundColor: isUp ? colors.success : colors.warning },
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
      </Card>

      {/* Category bars */}
      <Card title="Debt by Category">
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
                    <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: cat.color(colors) }]} />
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
      </Card>

      {/* Top issues */}
      <Card title="Top Issues">
        {!smells || smells.smells.length === 0 ? (
          <Text style={styles.emptyText}>No issues found.</Text>
        ) : (
          <>
            {smells.smells.map((smell, idx) => {
              const sevColor = severityColor(smell.severity, colors);
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
            {loadingMore ? (
              <ActivityIndicator style={styles.loadMoreSpinner} color={colors.primary} />
            ) : null}
            {loadMoreFailed ? (
              <ErrorState
                compact
                message="Could not load more issues."
                onRetry={() => void loadMoreIssues()}
                style={styles.loadMoreError}
              />
            ) : null}
            <Text style={styles.footnote}>
              Showing {smells.smells.length} of {smells.totalSmells}
            </Text>
          </>
        )}
      </Card>
    </ScrollView>

    <ScreenTour id="repoSummary" targets={{ gauge: gaugeRef, trend: trendRef }} />
    </>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    emptyText: {
      fontSize: 13,
      color: c.textMuted,
    },
    footnote: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 12,
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
      fontFamily: fonts.mono,
      fontSize: 34,
      fontWeight: '700',
    },
    gaugeOutOf: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.textMuted,
      marginTop: -2,
    },
    gaugeBand: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
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
      color: c.textMuted,
    },
    metaValue: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
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
      color: c.textMuted,
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
      color: c.text,
    },
    categoryValue: {
      fontSize: 12,
      color: c.textMuted,
    },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.divider,
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
      borderTopColor: c.divider,
    },
    issueRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
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
      borderRadius: radius.sm,
    },
    severityText: {
      fontSize: 10,
      fontWeight: '800',
    },
    newPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
      backgroundColor: `${c.link}20`,
    },
    newText: {
      fontSize: 10,
      fontWeight: '800',
      color: c.link,
    },
    issueRule: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: c.text,
    },
    issueFile: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.link,
    },
    issueMessage: {
      fontSize: 12,
      color: c.textMuted,
    },
    loadMoreSpinner: {
      marginTop: 12,
    },
    loadMoreError: {
      marginTop: 12,
      marginBottom: 0,
    },
  });
