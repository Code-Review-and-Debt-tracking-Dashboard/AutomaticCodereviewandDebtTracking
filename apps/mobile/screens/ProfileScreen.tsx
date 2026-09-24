import React, { useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { usePreferences, useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { api } from '../lib/apiClient';
import { useAsyncData } from '../hooks/useAsyncData';
import { Card, ErrorState, Eyebrow, Logo, ScreenHeader } from '../components';
import type { ThemePreference } from '../lib/preferencesStore';
import { fonts, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';

interface Org {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  type: string;
  role: string;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

const formatRole = (role: string) => role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, ' ');

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    themePreference,
    setThemePreference,
    notificationsEnabled,
    setNotificationsEnabled,
  } = usePreferences();
  const [signingOut, setSigningOut] = useState(false);

  const orgs = useAsyncData(async () => {
    const res = await api.get<{ data: Org[] }>('/api/orgs');
    return res.data ?? [];
  });

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    // Alert.alert has no buttons on react-native-web.
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Sign out of CodePulse?') ?? true) void signOut();
      return;
    }
    Alert.alert('Sign out?', 'You will need to sign in with GitHub again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const initials = (user?.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader eyebrow="Account" title="Profile" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={orgs.refreshing}
            onRefresh={() => void orgs.load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      >
        {/* Identity */}
        <Card>
          <View style={styles.identity}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.identityText}>
              <Text style={styles.username} numberOfLines={1}>
                {user?.username ?? 'Unknown user'}
              </Text>
              <View style={styles.identityMeta}>
                <Ionicons name="logo-github" size={13} color={colors.textMuted} />
                <Text style={styles.email} numberOfLines={1}>
                  {user?.email ?? `@${user?.username ?? ''}`}
                </Text>
              </View>
              {user?.platformRole ? (
                <View style={styles.roleChip}>
                  <Text style={styles.roleText}>{formatRole(user.platformRole)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Appearance */}
        <Card title="Appearance">
          <View style={styles.segmented} accessibilityRole="radiogroup">
            {THEME_OPTIONS.map((opt) => {
              const selected = themePreference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => setThemePreference(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label} theme`}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.help}>
            {themePreference === 'system'
              ? 'Follows your device setting.'
              : `Always ${themePreference}, whatever your device is set to.`}
          </Text>
        </Card>

        {/* Notifications */}
        <Card title="Notifications">
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: notificationsEnabled ? colors.accent : colors.muted }]}>
              <Ionicons
                name={notificationsEnabled ? 'notifications' : 'notifications-off'}
                size={18}
                color={notificationsEnabled ? colors.primary : colors.textMuted}
              />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Allow notifications</Text>
              <Text style={styles.settingHelp}>
                Quality-gate failures, sharp score drops and new critical vulnerabilities.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? colors.card : undefined}
              ios_backgroundColor={colors.border}
              accessibilityLabel="Allow notifications"
            />
          </View>
          {!notificationsEnabled ? (
            <Text style={styles.help}>
              Paused on this device. Alerts are still recorded and will be here when you turn this
              back on.
            </Text>
          ) : null}
        </Card>

        {/* Organizations */}
        <Card title="Organizations">
          {orgs.loading ? (
            <Text style={styles.help}>Loading…</Text>
          ) : orgs.error && !orgs.data ? (
            <ErrorState compact message={orgs.error} onRetry={() => void orgs.load()} style={styles.noMargin} />
          ) : (orgs.data ?? []).length === 0 ? (
            <Text style={styles.help}>You are not a member of any organization yet.</Text>
          ) : (
            (orgs.data ?? []).map((org, idx) => (
              <View key={org.id} style={[styles.orgRow, idx > 0 && styles.orgRowBorder]}>
                {org.avatarUrl ? (
                  <Image source={{ uri: org.avatarUrl }} style={styles.orgAvatar} />
                ) : (
                  <View style={[styles.orgAvatar, styles.avatarFallback]}>
                    <Ionicons name="business-outline" size={14} color={colors.primary} />
                  </View>
                )}
                <View style={styles.orgText}>
                  <Text style={styles.orgName} numberOfLines={1}>
                    {org.name ?? org.login}
                  </Text>
                  <Text style={styles.orgLogin} numberOfLines={1}>
                    {org.login}
                  </Text>
                </View>
                <Text style={styles.orgRole}>{formatRole(org.role)}</Text>
              </View>
            ))
          )}
        </Card>

        <TouchableOpacity
          style={[styles.signOut, signingOut && styles.disabled]}
          activeOpacity={0.8}
          onPress={confirmSignOut}
          disabled={signingOut}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Logo size={22} markOnly />
          <Eyebrow>CodePulse mobile</Eyebrow>
        </View>
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
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
    },
    avatarInitials: {
      fontSize: 22,
      fontWeight: '700',
      color: c.primary,
    },
    identityText: {
      flex: 1,
      gap: 4,
    },
    username: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
      color: c.textPrimary,
    },
    identityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    email: {
      flexShrink: 1,
      fontSize: 13,
      color: c.textMuted,
    },
    roleChip: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
      backgroundColor: c.accent,
    },
    roleText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.accentForeground,
    },
    segmented: {
      flexDirection: 'row',
      padding: 4,
      gap: 4,
      borderRadius: radius.lg,
      backgroundColor: c.muted,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    segmentSelected: {
      backgroundColor: c.card,
      borderColor: c.border,
    },
    segmentText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
    },
    segmentTextSelected: {
      color: c.textPrimary,
    },
    help: {
      marginTop: spacing.md,
      fontSize: 12,
      lineHeight: 18,
      color: c.textMuted,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    settingIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingText: {
      flex: 1,
      gap: 2,
    },
    settingTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textPrimary,
    },
    settingHelp: {
      fontSize: 12,
      lineHeight: 17,
      color: c.textMuted,
    },
    noMargin: {
      marginBottom: 0,
    },
    orgRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 10,
    },
    orgRowBorder: {
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    orgAvatar: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
    },
    orgText: {
      flex: 1,
    },
    orgName: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textPrimary,
    },
    orgLogin: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.textMuted,
    },
    orgRole: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      height: 48,
      marginTop: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: `${c.danger}55`,
      backgroundColor: `${c.danger}12`,
    },
    signOutText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.danger,
    },
    disabled: {
      opacity: 0.6,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      opacity: 0.8,
    },
  });
