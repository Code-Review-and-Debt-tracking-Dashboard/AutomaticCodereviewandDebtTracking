import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { useThemedStyles, useTheme } from '../contexts/PreferencesContext';
import { Eyebrow, Logo } from '../components';
import { getErrorMessage } from '../lib/errorMessage';
import { fonts, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';

// same text as the web login
const FEATURES = [
  'First-pass review on every pull request',
  'Debt measured in minutes, not guesses',
  'Quality gates that flag risky merges',
];

const PULSE = [4, 4, 5, 4, 3, 4, 14, 2, 22, 6, 4, 4, 5, 4, 3, 4, 10, 2, 16, 5, 4, 4, 4, 5, 4, 3, 4, 26, 2, 30, 8, 4, 4, 5, 4, 4];

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await login();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Logo />

        <View style={styles.hero}>
          <Text style={styles.headline}>
            Debt you can see{'\n'}is debt you can <Text style={styles.headlineAccent}>fix.</Text>
          </Text>

          <View style={styles.pulse} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {PULSE.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.pulseBar,
                  { height: h, opacity: 0.25 + (i / PULSE.length) * 0.75 },
                ]}
              />
            ))}
            <View style={styles.pulseDot} />
          </View>

          <Text style={styles.lede}>
            CodePulse reviews every pull request the moment it opens, flags what slipped in, and
            tracks your technical debt as one Health Score the whole team can read.
          </Text>
        </View>

        <View style={styles.card}>
          <Eyebrow>Sign in</Eyebrow>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardBody}>
            See your Health Scores, open findings and debt trend across every repository.
          </Text>

          {error ? (
            <View style={styles.notice}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.noticeText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              signingIn && styles.buttonDisabled,
            ]}
            onPress={() => void handleLogin()}
            disabled={signingIn}
            accessibilityRole="button"
            accessibilityLabel="Continue with GitHub"
          >
            {signingIn ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Ionicons name="logo-github" size={19} color={colors.bg} />
                <Text style={styles.buttonText}>Continue with GitHub</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.bg} />
              </>
            )}
          </Pressable>

          <View style={styles.features}>
            {FEATURES.map((text) => (
              <View key={text} style={styles.featureRow}>
                <Ionicons name="checkmark" size={16} color={colors.primary} />
                <Text style={styles.featureText}>{text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>WE NEVER SEE YOUR GITHUB PASSWORD.</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>AUTOMATED PR REVIEW</Text>
          <Text style={styles.footerText}>DEBT TRACKING</Text>
          <Text style={styles.footerText}>QUALITY GATES</Text>
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
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
    },
    hero: {
      marginTop: 40,
    },
    headline: {
      fontSize: 38,
      lineHeight: 40,
      fontWeight: '800',
      letterSpacing: -1.3,
      color: c.textPrimary,
    },
    headlineAccent: {
      color: c.primary,
    },
    pulse: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 40,
      gap: 3,
      marginVertical: spacing.xl,
    },
    pulseBar: {
      width: 3,
      borderRadius: 1,
      backgroundColor: c.primary,
    },
    pulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 4,
      backgroundColor: c.primary,
    },
    lede: {
      fontSize: 15,
      lineHeight: 24,
      color: c.textMuted,
    },
    card: {
      marginTop: 32,
      padding: spacing.xl,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    cardTitle: {
      marginTop: 10,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.7,
      color: c.textPrimary,
    },
    cardBody: {
      marginTop: 8,
      fontSize: 15,
      lineHeight: 22,
      color: c.textMuted,
    },
    notice: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      marginTop: spacing.lg,
      padding: 10,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: `${c.danger}4D`,
      backgroundColor: `${c.danger}1A`,
    },
    noticeText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: c.danger,
    },
    button: {
      marginTop: spacing.xl,
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: radius.sm,
      backgroundColor: c.textPrimary,
    },
    buttonPressed: {
      backgroundColor: c.primary,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.bg,
    },
    features: {
      marginTop: spacing.xl,
      paddingTop: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: spacing.md,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    featureText: {
      flex: 1,
      fontSize: 13,
      color: c.textMuted,
    },
    footnote: {
      marginTop: spacing.xl,
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1.2,
      color: c.textMuted,
    },
    footer: {
      marginTop: 'auto',
      paddingTop: spacing.xxl,
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: spacing.lg,
      rowGap: 6,
    },
    footerText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1.4,
      color: c.textMuted,
    },
  });
