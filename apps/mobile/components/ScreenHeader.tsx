import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { useThemedStyles } from '../contexts/PreferencesContext';
import { spacing } from '../theme';
import type { ThemeColors } from '../theme';
import { Eyebrow } from './Card';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function ScreenHeader({ eyebrow, title, subtitle, right }: ScreenHeaderProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.header}>
      <View style={styles.text}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: 20,
      paddingTop: spacing.lg,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    text: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.6,
      color: c.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: c.textMuted,
    },
  });
