import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';

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

const mockRepos: MobileRepo[] = [
  {
    id: 'repo-1',
    name: 'AutomaticCodeReview',
    fullName: 'CodePulse/AutomaticCodeReview',
    language: 'TypeScript',
    healthScore: 91,
    openFindings: 3,
    debtHours: 2.5,
    sparkline: [74, 78, 82, 85, 89, 91],
    isPrivate: true,
  },
  {
    id: 'repo-2',
    name: 'AnalysisWorker',
    fullName: 'CodePulse/AnalysisWorker',
    language: 'Python',
    healthScore: 84,
    openFindings: 8,
    debtHours: 4.2,
    sparkline: [88, 86, 85, 82, 84, 84],
    isPrivate: true,
  },
  {
    id: 'repo-3',
    name: 'MobileDashboard',
    fullName: 'CodePulse/MobileDashboard',
    language: 'TypeScript',
    healthScore: 78,
    openFindings: 12,
    debtHours: 6.8,
    sparkline: [65, 68, 72, 70, 75, 78],
    isPrivate: false,
  },
];

/**
 * Step 56 (E-05): Mobile home screen — repo list with sparklines
 */
export default function HomeScreen() {
  const [repos, setRepos] = useState<MobileRepo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching repo list for current active org
    const timer = setTimeout(() => {
      setRepos(mockRepos);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const renderSparkline = (points: number[]) => {
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
                  backgroundColor: isUp ? '#10B981' : '#F59E0B',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderRepoCard = ({ item }: { item: MobileRepo }) => {
    const scoreColor =
      item.healthScore >= 85
        ? '#10B981'
        : item.healthScore >= 70
        ? '#F59E0B'
        : '#EF4444';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.repoName}>{item.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.language}</Text>
            </View>
          </View>
          <View style={[styles.scorePill, { backgroundColor: `${scoreColor}20` }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {item.healthScore}
            </Text>
          </View>
        </View>

        <Text style={styles.fullName}>{item.fullName}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Findings</Text>
            <Text style={styles.metricValue}>{item.openFindings}</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Tech Debt</Text>
            <Text style={styles.metricValue}>{item.debtHours}h</Text>
          </View>

          <View style={styles.sparklineBox}>
            <Text style={styles.sparklineLabel}>7d Trend</Text>
            {renderSparkline(item.sparkline)}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Repositories</Text>
        <Text style={styles.headerSubtitle}>CodePulse Intelligence</Text>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={repos}
          keyExtractor={(item) => item.id}
          renderItem={renderRepoCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F0F6FC',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8B949E',
    marginTop: 2,
  },
  loaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repoName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#58A6FF',
  },
  badge: {
    backgroundColor: '#21262D',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    color: '#8B949E',
    fontWeight: '600',
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800',
  },
  fullName: {
    fontSize: 12,
    color: '#8B949E',
    marginTop: 4,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262D',
  },
  metricItem: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#8B949E',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C9D1D9',
  },
  sparklineBox: {
    alignItems: 'flex-end',
  },
  sparklineLabel: {
    fontSize: 10,
    color: '#8B949E',
    marginBottom: 4,
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    gap: 3,
  },
  sparklineBar: {
    width: 4,
    borderRadius: 2,
  },
});
