import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

/**
 * Shown when a request succeeded but came back with nothing.
 * Rendered inside the list so pull-to-refresh still works.
 */
export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.container, style]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={26} color={colors.primary} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? (
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={action.onPress}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
      gap: spacing.sm,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent,
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      textAlign: 'center',
    },
    description: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 300,
    },
    button: {
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
  });
