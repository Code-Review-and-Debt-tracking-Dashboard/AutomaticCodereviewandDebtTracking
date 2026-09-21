import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Dims and disables Retry while a load is already in flight. */
  retrying?: boolean;
  /** Inline banner for a failed refresh over data that is still on screen. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_MESSAGE = 'An error occurred while fetching information. Please try again.';

/**
 * Failure state with an explicit retry. Full variant replaces the screen body;
 * compact variant sits above content that is still usable.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = DEFAULT_MESSAGE,
  onRetry,
  retrying = false,
  compact = false,
  style,
}: ErrorStateProps) {
  if (compact) {
    return (
      <View style={[styles.banner, style]}>
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
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={[styles.button, retrying && styles.disabled]}
          activeOpacity={0.8}
          disabled={retrying}
          onPress={onRetry}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  icon: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  button: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.divider,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.link,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.danger}40`,
    backgroundColor: colors.card,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  bannerRetry: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.link,
  },
  disabled: {
    opacity: 0.5,
  },
});
