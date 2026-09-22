import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  PanResponder,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../lib/apiClient';
import { useAsyncData } from '../hooks/useAsyncData';
import { EmptyState, ErrorState, LoadingState } from '../components';
import { colors, radius, spacing } from '../theme';

interface NotificationData {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  repoName?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  type?: string;
}

const SwipeableItem = ({
  item,
  onDismiss,
  onPress,
}: {
  item: NotificationData;
  onDismiss: () => void;
  onPress: () => void;
}) => {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100 || gestureState.dx > 100) {
          Animated.timing(pan, {
            toValue: { x: gestureState.dx < 0 ? -500 : 500, y: 0 },
            duration: 200,
            useNativeDriver: false,
          }).start(() => onDismiss());
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteBackground}>
        <Text style={styles.deleteText}>Dismiss</Text>
      </View>
      <Animated.View
        style={[styles.notificationCard, { transform: [{ translateX: pan.x }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
          <View style={styles.notificationHeader}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.readAt && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {item.repoName && (
              <Text style={styles.repoName}>{item.repoName}</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function NotificationsScreen() {
  const { data, loading, refreshing, error, load, setData } = useAsyncData(async () => {
    const res = await api.get<{ data: NotificationData[] }>('/api/notifications');
    return res.data ?? [];
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleMarkRead = async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setData((prev) =>
        prev
          ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
          : prev
      );
    } catch (err) {
      // Optimistic update fallback
      setData((prev) =>
        prev
          ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
          : prev
      );
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setData((prev) => (prev ? prev.filter((n) => n.id !== id) : prev));
    } catch (err) {
      setData((prev) => (prev ? prev.filter((n) => n.id !== id) : prev));
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setData((prev) =>
        prev ? prev.map((n) => ({ ...n, readAt: new Date().toISOString() })) : prev
      );
    } catch (err) {
      setData((prev) =>
        prev ? prev.map((n) => ({ ...n, readAt: new Date().toISOString() })) : prev
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => void markAllRead()}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <LoadingState />
      ) : error && !data ? (
        <ErrorState
          title="Couldn't load notifications"
          message={error}
          onRetry={() => void load()}
          retrying={loading}
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SwipeableItem
              item={item}
              onDismiss={() => void handleDismiss(item.id)}
              onPress={() => void handleMarkRead(item.id)}
            />
          )}
          contentContainerStyle={
            notifications.length === 0
              ? [styles.listContent, styles.listEmpty]
              : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.success}
              colors={[colors.success]}
              progressBackgroundColor={colors.card}
            />
          }
          ListHeaderComponent={
            error ? (
              <ErrorState compact message={error} onRetry={() => void load(true)} retrying={refreshing} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title="You're all caught up"
              description="Alerts about your repositories will show up here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  markAllText: {
    fontSize: 14,
    color: colors.link,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
  },
  // Without flexGrow an empty list has no height and can't be pulled on Android.
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  swipeContainer: {
    marginBottom: spacing.md,
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  deleteBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: radius.lg,
  },
  deleteText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.link,
  },
  body: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
  },
  repoName: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    backgroundColor: colors.divider,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
