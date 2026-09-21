import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, spacing } from '../theme';

interface LoadingStateProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Centered spinner shown while a screen's initial fetch is in flight.
 */
export function LoadingState({ message, style }: LoadingStateProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.success} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  message: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textMuted,
  },
});
