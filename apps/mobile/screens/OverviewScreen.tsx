import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { api } from '../lib/apiClient';
import { useAsyncData } from '../hooks/useAsyncData';
import { usePreferences, useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { Card, EmptyState, ErrorState, Eyebrow, LoadingState, ScreenHeader } from '../components';
import { fonts, healthBand, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';
import type { RootTabParamList } from '../navigation/TabNavigator';

interface SummaryRepo {
  id: string;
  name: string;
  fullName: string;
  healthScore: number;
  scoreChange: number;
  openPRs: number;
  criticalIssues: number;
  lastAnalyzedAt: string | null;
}

interface MobileSummary {
  user: { username: string; avatarUrl: string | null } | null;
  unreadNotifications: number;
  repos: SummaryRepo[];
}

const ATTENTION_LIMIT = 3;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Portfolio-level view: one number for the whole workspace, how scores are
 * spread across the health bands, and which repositories need a look first.
 */
export default function OverviewScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { notificationsEnabled } = usePreferences();

  const { data, loading, refreshing, error, load } = useAsyncData(() =>
    api.get<MobileSummary>('/api/mobile/summary'),
  );

  const openRepo = (repo: SummaryRepo) =>
    navigation.navigate('Repositories', {
      screen: 'RepoSummary',
      params: { repoId: repo.id, repoName: repo.name },
    });

  const header = (
    <ScreenHeader
      eyebrow="Overview"
      title={data?.user ? `${greeting()}, ${data.user.username}` : greeting()}
      subtitle="Health across every repository you can see"
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <ErrorState
          title="Couldn't load your overview"
          message={error ?? undefined}
          onRetry={() => void load()}
          retrying={loading}
        />
      </SafeAreaView>
    );
  }

  // The API reports 80 for a repo that was never analyzed; leave those out of
  // the averages so they don't flatter the portfolio.
  const analyzed = data.repos.filter((r) => r.lastAnalyzedAt);
  const average = analyzed.length
    ? Math.round(analyzed.reduce((sum, r) => sum + r.healthScore, 0) / analyzed.length)
    : null;
  const avgChange = analyzed.length
    ? Math.round((analyzed.reduce((sum, r) => sum + r.scoreChange, 0) / analyzed.length) * 10) / 10
    : 0;
  const band = healthBand(average, colors);

  const criticalTotal = data.repos.reduce((sum, r) => sum + r.criticalIssues, 0);
  const openPrTotal = data.repos.reduce((sum, r) => sum + r.openPRs, 0);

  const distribution = [
    { label: 'Excellent', color: colors.success, count: analyzed.filter((r) => r.healthScore >= 90).length },
    { label: 'Good', color: colors.info, count: analyzed.filter((r) => r.healthScore >= 70 && r.healthScore < 90).length },
    { label: 'Fair', color: colors.warning, count: analyzed.filter((r) => r.healthScore >= 50 && r.healthScore < 70).length },
    { label: 'Poor', color: colors.danger, count: analyzed.filter((r) => r.healthScore < 50).length },
  ];

  const needsAttention = [...analyzed]
    .sort((a, b) => b.criticalIssues - a.criticalIssues || a.healthScore - b.healthScore)
    .slice(0, ATTENTION_LIMIT);

  const movers = analyzed
    .filter((r) => r.scoreChange !== 0)
    .sort((a, b) => Math.abs(b.scoreChange) - Math.abs(a.scoreChange))
    .slice(0, ATTENTION_LIMIT);

  const stats: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; tone?: string; onPress?: () => void }[] = [
    { label: 'Repositories', value: String(data.repos.length), icon: 'git-branch-outline', onPress: () => navigation.navigate('Repositories', { screen: 'RepoList' }) },
    { label: 'Critical', value: String(criticalTotal), icon: 'warning-outline', tone: criticalTotal > 0 ? colors.danger : undefined },
    { label: 'Open PRs', value: String(openPrTotal), icon: 'git-pull-request-outline' },
    {
      label: 'Unread',
      value: notificationsEnabled ? String(data.unreadNotifications) : 'Off',
      icon: notificationsEnabled ? 'notifications-outline' : 'notifications-off-outline',
      tone: notificationsEnabled && data.unreadNotifications > 0 ? colors.primary : undefined,
      onPress: () => navigation.navigate('Notifications'),
    },
  ];

  const renderRepoRow = (repo: SummaryRepo, detail: React.ReactNode) => {
    const repoBand = healthBand(repo.healthScore, colors);
    return (
      <TouchableOpacity
        key={repo.id}
        style={styles.repoRow}
        activeOpacity={0.7}
        onPress={() => openRepo(repo)}
      >
        <View style={[styles.repoScore, { backgroundColor: `${repoBand.color}1A` }]}>
          <Text style={[styles.repoScoreText, { color: repoBand.color }]}>
            {Math.round(repo.healthScore)}
          </Text>
        </View>
        <View style={styles.repoInfo}>
          <Text style={styles.repoName} numberOfLines={1}>
            {repo.name}
          </Text>
          {detail}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {error ? (
          <ErrorState compact message={error} onRetry={() => void load(true)} retrying={refreshing} />
        ) : null}

        {data.repos.length === 0 ? (
          <EmptyState
            icon="analytics-outline"
            title="Nothing to summarise yet"
            description="Link a repository from the web dashboard and its health will roll up here."
            action={{ label: 'Refresh', onPress: () => void load(true) }}
          />
        ) : (
          <>
            {/* Portfolio score */}
            <Card>
              <Eyebrow>Portfolio health</Eyebrow>
              <View style={styles.heroRow}>
                <Text style={[styles.heroScore, { color: band.color }]}>{average ?? '—'}</Text>
                <View style={styles.heroMeta}>
                  <Text style={[styles.heroBand, { color: band.color }]}>{band.label}</Text>
                  <Text
                    style={[
                      styles.heroDelta,
                      { color: avgChange > 0 ? colors.success : avgChange < 0 ? colors.danger : colors.textMuted },
                    ]}
                  >
                    {avgChange > 0 ? `▲ +${avgChange}` : avgChange < 0 ? `▼ ${avgChange}` : '— steady'} avg vs last scan
                  </Text>
                </View>
              </View>

              {analyzed.length > 0 ? (
                <>
                  <View style={styles.distBar}>
                    {distribution
                      .filter((d) => d.count > 0)
                      .map((d) => (
                        <View key={d.label} style={{ flex: d.count, backgroundColor: d.color }} />
                      ))}
                  </View>
                  <View style={styles.legend}>
                    {distribution.map((d) => (
                      <View key={d.label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                        <Text style={styles.legendText}>
                          {d.label} <Text style={styles.legendCount}>{d.count}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.muted}>No repository has been analyzed yet.</Text>
              )}
            </Card>

            {/* Stat tiles */}
            <View style={styles.statGrid}>
              {stats.map((s) => {
                const tile = (
                  <>
                    <View style={styles.statTop}>
                      <Ionicons name={s.icon} size={16} color={s.tone ?? colors.textMuted} />
                      {s.onPress ? (
                        <Ionicons name="arrow-forward" size={13} color={colors.textMuted} />
                      ) : null}
                    </View>
                    <Text style={[styles.statValue, s.tone ? { color: s.tone } : null]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </>
                );
                return s.onPress ? (
                  <TouchableOpacity key={s.label} style={styles.statTile} activeOpacity={0.7} onPress={s.onPress}>
                    {tile}
                  </TouchableOpacity>
                ) : (
                  <View key={s.label} style={styles.statTile}>
                    {tile}
                  </View>
                );
              })}
            </View>

            {/* Needs attention */}
            {needsAttention.length > 0 ? (
              <Card title="Needs attention">
                {needsAttention.map((repo) =>
                  renderRepoRow(
                    repo,
                    <Text style={styles.repoDetail}>
                      {repo.criticalIssues > 0 ? (
                        <Text style={{ color: colors.danger }}>
                          {repo.criticalIssues} critical ·{' '}
                        </Text>
                      ) : null}
                      {repo.openPRs} open PR{repo.openPRs === 1 ? '' : 's'}
                    </Text>,
                  ),
                )}
              </Card>
            ) : null}

            {/* Movers */}
            {movers.length > 0 ? (
              <Card title="Biggest movers">
                {movers.map((repo) =>
                  renderRepoRow(
                    repo,
                    <Text
                      style={[
                        styles.repoDetail,
                        { color: repo.scoreChange > 0 ? colors.success : colors.danger },
                      ]}
                    >
                      {repo.scoreChange > 0 ? `▲ +${repo.scoreChange}` : `▼ ${repo.scoreChange}`} since
                      last scan
                    </Text>,
                  ),
                )}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
      flexGrow: 1,
    },
    muted: {
      marginTop: spacing.md,
      fontSize: 13,
      color: c.textMuted,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    heroScore: {
      fontFamily: fonts.mono,
      fontSize: 56,
      fontWeight: '700',
      letterSpacing: -2,
    },
    heroMeta: {
      flex: 1,
      gap: 4,
    },
    heroBand: {
      fontSize: 18,
      fontWeight: '700',
    },
    heroDelta: {
      fontSize: 12,
    },
    distBar: {
      flexDirection: 'row',
      height: 8,
      marginTop: spacing.lg,
      borderRadius: radius.sm,
      overflow: 'hidden',
      gap: 2,
      backgroundColor: c.muted,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: spacing.lg,
      rowGap: 6,
      marginTop: spacing.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 12,
      color: c.textMuted,
    },
    legendCount: {
      fontFamily: fonts.mono,
      fontWeight: '700',
      color: c.text,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    statTile: {
      flexGrow: 1,
      flexBasis: '45%',
      padding: 14,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    statTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statValue: {
      marginTop: spacing.md,
      fontFamily: fonts.mono,
      fontSize: 26,
      fontWeight: '700',
      color: c.textPrimary,
    },
    statLabel: {
      marginTop: 2,
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    repoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    repoScore: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    repoScoreText: {
      fontFamily: fonts.mono,
      fontSize: 16,
      fontWeight: '700',
    },
    repoInfo: {
      flex: 1,
      gap: 2,
    },
    repoName: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textPrimary,
    },
    repoDetail: {
      fontSize: 12,
      color: c.textMuted,
    },
  });
