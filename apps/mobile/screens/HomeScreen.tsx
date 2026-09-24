import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api } from '../lib/apiClient';
import { useAsyncData } from '../hooks/useAsyncData';
import { useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { EmptyState, ErrorState, LoadingState, ScreenHeader } from '../components';
import { fonts, healthBand, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';
import type { HomeStackParamList } from '../navigation/TabNavigator';

interface MobileRepo {
  id: string;
  name: string;
  fullName: string;
  language: string;
  healthScore: number;
  openFindings: number;
  debtHours: number;
  sparkline: number[];
  isPrivate: boolean;
}

async function loadRepos(): Promise<MobileRepo[]> {
  const orgs = await api.get<{ data: { id: string }[] }>('/api/orgs');
  const orgId = orgs.data[0]?.id;
  if (!orgId) return [];

  const response = await api.get<{ data: Array<{
    id: string;
    name: string;
    fullName: string;
    language: string | null;
    healthScore: number;
    openFindings: number;
    debtMinutes: number;
    private: boolean;
  }> }>(`/api/orgs/${orgId}/repos`);

  return Promise.all(response.data.map(async (repo) => {
    // A missing trend shouldn't take the whole list down with it.
    const trend = await api
      .get<{ dataPoints: { healthScore: number }[] }>(`/api/repos/${repo.id}/trend?days=30`)
      .catch(() => ({ dataPoints: [] as { healthScore: number }[] }));
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      language: repo.language ?? 'Unknown',
      healthScore: repo.healthScore,
      openFindings: repo.openFindings,
      debtHours: Math.round((repo.debtMinutes / 60) * 10) / 10,
      sparkline: trend.dataPoints.map((point) => point.healthScore),
      isPrivate: repo.private,
    };
  }));
}

/**
 * Step 56 (E-05): Mobile home screen — repo list with sparklines
 */
export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { data, loading, refreshing, error, load } = useAsyncData(loadRepos);
  const [query, setQuery] = useState('');

  const allRepos = data ?? [];
  const needle = query.trim().toLowerCase();
  const repos = needle
    ? allRepos.filter((r) => r.fullName.toLowerCase().includes(needle))
    : allRepos;

  const renderSparkline = (points: number[]) => {
    if (points.length === 0) {
      return <Text style={styles.sparklineEmpty}>no scans</Text>;
    }

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    return (
      <View style={styles.sparklineContainer}>
        {points.map((val, idx) => {
          const heightPct = Math.max(15, ((val - min) / range) * 100);
          const isUp = idx > 0 && val >= points[idx - 1];
          return (
            <View
              key={idx}
              style={[
                styles.sparklineBar,
                {
                  height: `${heightPct}%`,
                  backgroundColor: isUp ? colors.success : colors.warning,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderRepoCard = ({ item }: { item: MobileRepo }) => {
    const band = healthBand(item.healthScore, colors);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('RepoSummary', { repoId: item.id, repoName: item.name })}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, health score ${item.healthScore}, ${band.label}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.repoName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.isPrivate && (
                <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
              )}
            </View>
            <Text style={styles.fullName} numberOfLines={1}>
              {item.fullName}
            </Text>
          </View>
          <View style={styles.scoreBlock}>
            <Text style={[styles.scoreText, { color: band.color }]}>
              {Math.round(item.healthScore)}
            </Text>
            <Text style={[styles.bandText, { color: band.color }]}>{band.label}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Language</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {item.language}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Findings</Text>
            <Text style={styles.metricValue}>{item.openFindings}</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Debt</Text>
            <Text style={styles.metricValue}>{item.debtHours}h</Text>
          </View>

          <View style={styles.sparklineBox}>
            <Text style={styles.metricLabel}>30d</Text>
            {renderSparkline(item.sparkline)}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        eyebrow="Workspace"
        title="Repositories"
        subtitle={data ? `${allRepos.length} linked` : undefined}
      />

      {loading ? (
        <LoadingState />
      ) : error && !data ? (
        <ErrorState
          title="Couldn't load repositories"
          message={error}
          onRetry={() => void load()}
          retrying={loading}
        />
      ) : (
        <FlatList
          data={repos}
          keyExtractor={(item) => item.id}
          renderItem={renderRepoCard}
          contentContainerStyle={
            repos.length === 0 ? [styles.listContent, styles.listEmpty] : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.card}
            />
          }
          ListHeaderComponent={
            <>
              {error ? (
                <ErrorState compact message={error} onRetry={() => void load(true)} retrying={refreshing} />
              ) : null}
              {allRepos.length > 0 ? (
                <View style={styles.search}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Filter repositories"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            needle ? (
              <EmptyState
                icon="search-outline"
                title="No matches"
                description={`Nothing matches "${query.trim()}".`}
                action={{ label: 'Clear filter', onPress: () => setQuery('') }}
              />
            ) : (
              <EmptyState
                icon="git-branch-outline"
                title="No repositories yet"
                description="Link a repository from the web dashboard and it will show up here."
                action={{ label: 'Refresh', onPress: () => void load(true) }}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    listContent: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    // Without flexGrow an empty list has no height and can't be pulled on Android.
    listEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      height: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: c.textPrimary,
      paddingVertical: 0,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    titleBlock: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    repoName: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: c.textPrimary,
    },
    fullName: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.textMuted,
      marginTop: 3,
    },
    scoreBlock: {
      alignItems: 'flex-end',
    },
    scoreText: {
      fontFamily: fonts.mono,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 26,
    },
    bandText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: spacing.md,
      marginTop: 14,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    metricItem: {
      gap: 3,
      flexShrink: 1,
    },
    metricLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    metricValue: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
    },
    sparklineBox: {
      alignItems: 'flex-end',
      gap: 4,
    },
    sparklineContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 22,
      gap: 2,
    },
    sparklineBar: {
      width: 3,
      borderRadius: 1,
    },
    sparklineEmpty: {
      fontSize: 11,
      color: c.textMuted,
      height: 22,
      lineHeight: 22,
    },
  });
