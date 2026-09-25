import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  PanResponder,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../lib/apiClient';
import { onPushActivity } from '../lib/pushNotifications';
import { useAsyncData } from '../hooks/useAsyncData';
import { usePreferences, useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { EmptyState, ErrorState, LoadingState, ScreenHeader } from '../components';
import { fonts, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';

type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low';

interface NotificationData {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  repoName?: string;
  severity?: NotificationSeverity;
  type?: string;
}

// Same tones as the web's NotificationItem.
const severityColor = (severity: NotificationSeverity | undefined, c: ThemeColors) => {
  switch (severity) {
    case 'critical':
      return c.danger;
    case 'high':
      return c.warning;
    case 'medium':
      return c.info;
    default:
      return c.textMuted;
  }
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pan = useRef(new Animated.ValueXY()).current;
  const tone = severityColor(item.severity, colors);
  const unread = !item.readAt;

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
        <Ionicons name="checkmark-done" size={18} color={colors.white} />
        <Text style={styles.deleteText}>Dismiss</Text>
      </View>
      <Animated.View
        style={[
          styles.notificationCard,
          unread && styles.notificationUnread,
          { transform: [{ translateX: pan.x }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.severityStripe, { backgroundColor: tone }]} />
        <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.cardBody}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.title, !unread && styles.titleRead]} numberOfLines={1}>
              {item.title}
            </Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              {item.severity ? (
                <Text style={[styles.severity, { color: tone }]}>{item.severity}</Text>
              ) : null}
              {item.repoName ? (
                <Text style={styles.repoName} numberOfLines={1}>
                  {item.repoName}
                </Text>
              ) : null}
            </View>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { notificationsEnabled, setNotificationsEnabled } = usePreferences();

  const { data, loading, refreshing, error, load, setData } = useAsyncData(async () => {
    const res = await api.get<{ data: NotificationData[] }>('/api/notifications');
    return res.data ?? [];
  });

  // The tab stays mounted, so without this a push would open a stale list.
  useEffect(() => onPushActivity(() => void load(true)), [load]);

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

  const header = (
    <ScreenHeader
      eyebrow="Inbox"
      title="Notifications"
      subtitle={
        !notificationsEnabled
          ? 'Paused on this device'
          : data
          ? unreadCount > 0
            ? `${unreadCount} unread`
            : 'All read'
          : undefined
      }
      right={
        notificationsEnabled && unreadCount > 0 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => void markAllRead()}
            style={styles.markAll}
          >
            <Ionicons name="checkmark-done" size={15} color={colors.link} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );

  if (!notificationsEnabled) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <EmptyState
          style={styles.paused}
          icon="notifications-off-outline"
          title="Notifications are off"
          description="You won't see alerts about failed quality gates, score drops or new vulnerabilities until you turn them back on."
          action={{ label: 'Turn on notifications', onPress: () => setNotificationsEnabled(true) }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}

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
              {notifications.length > 0 ? (
                <Text style={styles.hint}>Tap to mark read · swipe to dismiss</Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up"
              description="Alerts about your repositories will show up here."
            />
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
    paused: {
      flex: 1,
    },
    markAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
    },
    markAllText: {
      fontSize: 13,
      color: c.link,
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
    hint: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textMuted,
      marginBottom: spacing.md,
    },
    swipeContainer: {
      marginBottom: spacing.md,
      position: 'relative',
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    deleteBackground: {
      ...StyleSheet.absoluteFill,
      flexDirection: 'row',
      gap: 6,
      backgroundColor: c.primary,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingRight: 20,
      borderRadius: radius.lg,
    },
    deleteText: {
      color: c.white,
      fontWeight: 'bold',
    },
    notificationCard: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    notificationUnread: {
      borderColor: `${c.primary}66`,
    },
    severityStripe: {
      width: 3,
    },
    cardBody: {
      flex: 1,
      padding: spacing.lg,
    },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      flex: 1,
      marginRight: spacing.sm,
    },
    titleRead: {
      fontWeight: '500',
      color: c.text,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
    },
    body: {
      fontSize: 13,
      color: c.textMuted,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    footerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 1,
    },
    severity: {
      fontFamily: fonts.mono,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.textMuted,
    },
    repoName: {
      flexShrink: 1,
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.textMuted,
      backgroundColor: c.muted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
  });
