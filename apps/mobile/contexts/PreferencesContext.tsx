import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from '../lib/preferencesStore';
import type { Preferences, ThemePreference } from '../lib/preferencesStore';
import { darkColors, lightColors } from '../theme';
import type { ThemeColors } from '../theme';

interface PreferencesContextValue {
  /** What the user picked — may be 'system'. */
  themePreference: ThemePreference;
  /** What is actually on screen once 'system' is resolved. */
  scheme: 'light' | 'dark';
  isDark: boolean;
  colors: ThemeColors;
  notificationsEnabled: boolean;
  activeOrgId: string | null;
  toursDone: string[];
  isLoaded: boolean;
  setThemePreference: (theme: ThemePreference) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setActiveOrgId: (orgId: string) => void;
  finishTour: (id: string) => void;
  skipTours: (ids: string[]) => void;
  replayTours: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>');
  }
  return ctx;
}

export function useTheme() {
  const { colors, isDark, scheme } = usePreferences();
  return { colors, isDark, scheme };
}

/**
 * Builds a screen's StyleSheet from the active palette and rebuilds it only
 * when the theme flips. `makeStyles` must be a module-level function.
 */
export function useThemedStyles<T>(makeStyles: (c: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors, makeStyles]);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    void loadPreferences().then((stored) => {
      setPrefs(stored);
      setIsLoaded(true);
    });
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void savePreferences(next);
      return next;
    });
  }, []);

  const setThemePreference = useCallback((theme: ThemePreference) => update({ theme }), [update]);
  const setNotificationsEnabled = useCallback(
    (notificationsEnabled: boolean) => update({ notificationsEnabled }),
    [update],
  );
  const setActiveOrgId = useCallback((activeOrgId: string) => update({ activeOrgId }), [update]);
  const finishTour = useCallback(
    (id: string) => setPrefs((prev) => {
      const next = { ...prev, toursDone: [...prev.toursDone, id] };
      void savePreferences(next);
      return next;
    }),
    [],
  );
  const skipTours = useCallback((toursDone: string[]) => update({ toursDone }), [update]);
  const replayTours = useCallback(() => update({ toursDone: [] }), [update]);

  const scheme: 'light' | 'dark' =
    prefs.theme === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : prefs.theme;

  const value = useMemo<PreferencesContextValue>(
    () => ({
      themePreference: prefs.theme,
      scheme,
      isDark: scheme === 'dark',
      colors: scheme === 'dark' ? darkColors : lightColors,
      notificationsEnabled: prefs.notificationsEnabled,
      activeOrgId: prefs.activeOrgId,
      toursDone: prefs.toursDone,
      isLoaded,
      setThemePreference,
      setNotificationsEnabled,
      setActiveOrgId,
      finishTour,
      skipTours,
      replayTours,
    }),
    [
      prefs,
      scheme,
      isLoaded,
      setThemePreference,
      setNotificationsEnabled,
      setActiveOrgId,
      finishTour,
      skipTours,
      replayTours,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
