import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode, Ref } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { useThemedStyles } from '../contexts/PreferencesContext';
import { fonts, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';

/** Small mono label above titles and on stat cards — the web's `.eyebrow`. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

interface CardProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<View>;
}

export function Card({ title, right, children, style, ref }: CardProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View ref={ref} style={[styles.card, style]}>
      {title || right ? (
        <View style={styles.header}>
          {title ? <Eyebrow>{title}</Eyebrow> : <View />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
  });
