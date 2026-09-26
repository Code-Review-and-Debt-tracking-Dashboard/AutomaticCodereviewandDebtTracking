import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { fonts, radius } from '../theme';
import type { ThemeColors } from '../theme';

interface LogoProps {
  size?: number;
  markOnly?: boolean;
}

// no svg renderer here, so the pulse icon stands in for the web logo
export function Logo({ size = 30, markOnly = false }: LogoProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const mark = (
    <View style={[styles.mark, { width: size, height: size }]}>
      <Ionicons name="pulse" size={size * 0.66} color={colors.primary} />
    </View>
  );

  if (markOnly) return mark;

  return (
    <View style={styles.row}>
      {mark}
      <View>
        <Text style={styles.name}>CodePulse</Text>
        <Text style={styles.tagline}>CODE HEALTH</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    mark: {
      borderRadius: radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: c.textPrimary,
    },
    tagline: {
      marginTop: 2,
      fontFamily: fonts.mono,
      fontSize: 9,
      letterSpacing: 2,
      color: c.textMuted,
    },
  });
