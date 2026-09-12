import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { api } from '../lib/apiClient';

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
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: NotificationData[] }>('/api/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      // Optimistic update fallback
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Notifications</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  markAllText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  swipeContainer: {
    marginBottom: 12,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: 12,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  body: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  repoName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
