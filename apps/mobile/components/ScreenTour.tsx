import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { usePreferences, useThemedStyles } from '../contexts/PreferencesContext';
import { fonts, radius, spacing } from '../theme';
import type { ThemeColors } from '../theme';
import { Eyebrow } from './Card';

interface Step {
  target?: string;
  title: string;
  text: string;
  // the user moves on by tapping this tab instead of Next
  tab?: string;
}

// target matches a key in the targets prop the screen passes in
const tours = {
  overview: [
    {
      title: 'Welcome to CodePulse',
      text: "Here's a quick look around. Each screen shows a short guide the first time you open it.",
    },
    {
      target: 'score',
      title: 'Portfolio health',
      text: 'The average Health Score across every repository you can see.',
    },
    {
      target: 'stats',
      title: 'At a glance',
      text: 'Repos, open findings and unread alerts. Tap a tile to jump straight there.',
    },
    {
      tab: 'Repositories',
      title: 'Repositories',
      text: 'Your linked repos live in the Repositories tab.',
    },
  ],
  repositories: [
    {
      target: 'firstRepo',
      title: 'Your repositories',
      text: 'Tap a repo to see its Health Score, trend and top issues. Link new repos from the web dashboard.',
    },
    {
      tab: 'Notifications',
      title: 'Notifications',
      text: 'Alerts about your repos land in the Notifications tab.',
    },
  ],
  repoSummary: [
    {
      target: 'gauge',
      title: 'Health Score',
      text: 'Score out of 100 from the latest analysis, and which band it falls in.',
    },
    {
      target: 'trend',
      title: '30-day trend',
      text: 'How the score has moved over the last month.',
    },
    {
      title: 'More below',
      text: 'Scroll down for debt by category and the top issues to fix first.',
    },
  ],
  notifications: [
    {
      target: 'firstNotification',
      title: 'Alerts',
      text: "You'll get one when an analysis finishes, a PR is checked or a quality gate fails. Tap it to mark it read.",
    },
    {
      tab: 'Profile',
      title: 'Profile',
      text: 'Your settings live in the Profile tab.',
    },
  ],
  profile: [
    {
      target: 'appearance',
      title: 'Appearance',
      text: 'Light, dark, or follow your phone.',
    },
    {
      target: 'notifications',
      title: 'Notifications',
      text: 'Turn alerts on or off for this device.',
    },
    {
      target: 'orgs',
      title: 'Organizations',
      text: 'Pick which organization the Repositories tab shows.',
    },
    {
      title: 'All set',
      text: 'You can replay these guides from here any time.',
    },
  ],
} satisfies Record<string, Step[]>;

type TourId = keyof typeof tours;
type Targets = Record<string, RefObject<View | null>>;

interface ScreenTourProps {
  id: TourId;
  targets?: Targets;
}

/** Put this last inside a screen's root view. */
export function ScreenTour({ id, targets = {} }: ScreenTourProps) {
  const focused = useIsFocused();
  const { toursDone, finishTour, skipTours } = usePreferences();

  if (toursDone.includes(id)) return null;

  return (
    <TourSteps
      steps={tours[id]}
      targets={targets}
      focused={focused}
      onFinish={() => finishTour(id)}
      onSkip={() => skipTours(Object.keys(tours))}
    />
  );
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourStepsProps {
  steps: Step[];
  targets: Targets;
  focused: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

const CARD_HEIGHT = 190;
const GAP = 12;
const PAD = 6;

function TourSteps({ steps, targets, focused, onFinish, onSkip }: TourStepsProps) {
  const styles = useThemedStyles(makeStyles);
  const overlayRef = useRef<View>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [height, setHeight] = useState(0);

  const step = steps[index];
  const last = index === steps.length - 1;

  // leaving the screen on a tab step means they tapped the tab, so this guide is done
  useEffect(() => {
    if (!focused && step.tab) onFinish();
  }, [focused]);

  // keep looking for the target, since most screens load their data after a moment
  useEffect(() => {
    if (!focused) return;

    const measure = () => {
      const target = step.target ? targets[step.target]?.current : null;
      const overlay = overlayRef.current;

      if (!target || !overlay) {
        setRect(null);
        return;
      }

      // both in window coordinates, so subtracting cancels the status bar and header
      overlay.measureInWindow((ox, oy, _ow, oh) => {
        target.measureInWindow((x, y, width, h) => {
          const top = y - oy;
          const visible = width > 0 && h > 0 && top >= 0 && top < oh;
          const next = visible
            ? { x: x - ox, y: top, width, height: Math.min(h, oh - top) }
            : null;
          setRect((prev) => (sameRect(prev, next) ? prev : next));
        });
      });
    };

    measure();
    const timer = setInterval(measure, 300);
    return () => clearInterval(timer);
  }, [focused, step]);

  if (!focused) return null;

  const hole = rect && {
    x: rect.x - PAD,
    y: rect.y - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  // below the target if it fits, then above, otherwise at the bottom (near the tab bar)
  let cardPosition: ViewStyle = { bottom: spacing.lg };
  if (hole && hole.y + hole.height + GAP + CARD_HEIGHT < height) {
    cardPosition = { top: hole.y + hole.height + GAP };
  } else if (hole && hole.y - GAP - CARD_HEIGHT > 0) {
    cardPosition = { bottom: height - hole.y + GAP };
  }

  const centred = !hole && !step.tab;

  return (
    <View
      ref={overlayRef}
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      accessibilityViewIsModal
    >
      {hole ? (
        <>
          {/* four dark panels around the target */}
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(hole.y, 0) }]} />
          <View style={[styles.dim, { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.dim, { top: hole.y, left: 0, width: Math.max(hole.x, 0), height: hole.height }]} />
          <View style={[styles.dim, { top: hole.y, left: hole.x + hole.width, right: 0, height: hole.height }]} />
          <View style={[styles.ring, { top: hole.y, left: hole.x, width: hole.width, height: hole.height }]} />
        </>
      ) : (
        <View style={[styles.dim, StyleSheet.absoluteFill]} />
      )}

      <View style={centred ? styles.centre : [styles.cardSlot, cardPosition]}>
        <View style={styles.card}>
          <Eyebrow>
            {index + 1} of {steps.length}
          </Eyebrow>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.text}>{step.text}</Text>

          {step.tab ? (
            <Text style={styles.hint}>Tap {step.tab} in the tab bar below ↓</Text>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity onPress={onSkip} hitSlop={8}>
              <Text style={styles.skip}>Skip tour</Text>
            </TouchableOpacity>

            <View style={styles.actions}>
              {index > 0 ? (
                <TouchableOpacity style={styles.back} onPress={() => setIndex(index - 1)}>
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
              ) : null}

              {!step.tab ? (
                <TouchableOpacity
                  style={styles.next}
                  onPress={last ? onFinish : () => setIndex(index + 1)}
                >
                  <Text style={styles.nextText}>{last ? 'Finish' : 'Next'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    dim: {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    ring: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: c.primary,
      borderRadius: radius.lg,
    },
    centre: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    cardSlot: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
    },
    title: {
      marginTop: spacing.xs,
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
    },
    text: {
      marginTop: spacing.xs,
      fontSize: 13,
      lineHeight: 19,
      color: c.textMuted,
    },
    hint: {
      marginTop: spacing.sm,
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.primary,
    },
    footer: {
      marginTop: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    skip: {
      fontSize: 12,
      color: c.textMuted,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    back: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    backText: {
      fontSize: 12,
      color: c.textPrimary,
    },
    next: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    nextText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.primaryForeground,
    },
  });
