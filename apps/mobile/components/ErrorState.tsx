import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** small banner over data that's still shown */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_MESSAGE = 'An error occurred while fetching information. Please try again.';

export function ErrorState({
  title = 'Something went wrong',
  message = DEFAULT_MESSAGE,
  onRetry,
  retrying = false,
  compact = false,
  style,
}: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (compact) {
    return (
      <View style={[styles.banner, style]}>
        <Ionicons name="alert-circle" size={18} color={colors.danger} />
        <Text style={styles.bannerText} numberOfLines={2}>
          {message}
        </Text>
        {onRetry ? (
          <TouchableOpacity activeOpacity={0.8} disabled={retrying} onPress={onRetry}>
            <Text style={[styles.bannerRetry, retrying && styles.disabled]}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={[styles.button, retrying && styles.disabled]}
          activeOpacity={0.8}
          disabled={retrying}
          onPress={onRetry}
        >
          <Ionicons name="refresh" size={16} color={colors.primaryForeground} />
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
      gap: spacing.sm,
      backgroundColor: c.bg,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${c.danger}1A`,
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      textAlign: 'center',
    },
    message: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 300,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: c.primary,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.primaryForeground,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: `${c.danger}40`,
      backgroundColor: `${c.danger}12`,
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      color: c.text,
    },
    bannerRetry: {
      fontSize: 14,
      fontWeight: '600',
      color: c.link,
    },
    disabled: {
      opacity: 0.5,
    },
  });
