import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  theme: ThemePreference;
  notificationsEnabled: boolean;
  /** null = first org */
  activeOrgId: string | null;
  toursDone: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  notificationsEnabled: true,
  activeOrgId: null,
  toursDone: [],
};

const PREFERENCES_KEY = 'ch_preferences';

const isWeb = Platform.OS === 'web';

export async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = isWeb
      ? globalThis.localStorage?.getItem(PREFERENCES_KEY) ?? null
      : await SecureStore.getItemAsync(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: ['system', 'light', 'dark'].includes(parsed.theme as string)
        ? (parsed.theme as ThemePreference)
        : DEFAULT_PREFERENCES.theme,
      notificationsEnabled:
        typeof parsed.notificationsEnabled === 'boolean'
          ? parsed.notificationsEnabled
          : DEFAULT_PREFERENCES.notificationsEnabled,
      activeOrgId:
        typeof parsed.activeOrgId === 'string' ? parsed.activeOrgId : DEFAULT_PREFERENCES.activeOrgId,
      toursDone: Array.isArray(parsed.toursDone)
        ? parsed.toursDone.filter((id): id is string => typeof id === 'string')
        : DEFAULT_PREFERENCES.toursDone,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  const raw = JSON.stringify(prefs);
  try {
    if (isWeb) globalThis.localStorage?.setItem(PREFERENCES_KEY, raw);
    else await SecureStore.setItemAsync(PREFERENCES_KEY, raw);
  } catch {
  }
}
