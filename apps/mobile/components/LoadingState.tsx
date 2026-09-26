import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { spacing } from '../theme';
import type { ThemeColors } from '../theme';

interface LoadingStateProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Centered spinner shown while a screen's initial fetch is in flight.
 */
export function LoadingState({ message, style }: LoadingStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
    },
    message: {
      marginTop: spacing.md,
      fontSize: 13,
      color: c.textMuted,
    },
  });
