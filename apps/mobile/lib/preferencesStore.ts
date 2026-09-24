import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  theme: ThemePreference;
  notificationsEnabled: boolean;
  /** Org the Repositories tab shows. null → the first org the API returns. */
  activeOrgId: string | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  notificationsEnabled: true,
  activeOrgId: null,
};

const PREFERENCES_KEY = 'ch_preferences';

// Same split as the refresh token: expo-secure-store has no web implementation.
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
    };
  } catch {
    // A corrupt or unreadable value shouldn't stop the app from starting.
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  const raw = JSON.stringify(prefs);
  try {
    if (isWeb) globalThis.localStorage?.setItem(PREFERENCES_KEY, raw);
    else await SecureStore.setItemAsync(PREFERENCES_KEY, raw);
  } catch {
    // Not persisting is acceptable — the in-memory value still applies.
  }
}
