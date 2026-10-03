import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import MockAdapter from 'axios-mock-adapter';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PreferencesProvider } from '../contexts/PreferencesContext';
import { axiosInstance, refreshClient } from '../lib/apiClient';
import { DEFAULT_PREFERENCES } from '../lib/preferencesStore';
import type { Preferences } from '../lib/preferencesStore';

// fakes the API at the axios layer, so the real interceptors still run.
// refresh calls go through the same mock. a request with no handler fails the call
export const apiMock = new MockAdapter(axiosInstance, { onNoMatch: 'throwException' });
refreshClient.defaults.adapter = axiosInstance.defaults.adapter;

// same keys as lib/apiClient.ts and lib/preferencesStore.ts
const REFRESH_TOKEN_KEY = 'ch_refresh_token';
const PREFERENCES_KEY = 'ch_preferences';

const secureStore = (): Map<string, string> =>
  jest.requireMock<{ __store: Map<string, string> }>('expo-secure-store').__store;

export function clearSecureStore(): void {
  secureStore().clear();
}

export function seedRefreshToken(token: string): void {
  secureStore().set(REFRESH_TOKEN_KEY, token);
}

export function storedRefreshToken(): string | null {
  return secureStore().get(REFRESH_TOKEN_KEY) ?? null;
}

export function seedPreferences(prefs: Partial<Preferences>): void {
  secureStore().set(PREFERENCES_KEY, JSON.stringify({ ...DEFAULT_PREFERENCES, ...prefs }));
}

/** body of the nth request sent to `url` */
export function sentBody(method: 'post' | 'put', url: string, nth = 0): unknown {
  const request = apiMock.history[method].filter((r) => r.url === url)[nth];
  return request?.data ? JSON.parse(request.data as string) : undefined;
}

export function requestsTo(method: 'get' | 'post' | 'put' | 'delete', url: string) {
  return apiMock.history[method].filter((r) => r.url === url);
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </SafeAreaProvider>
  );
}

// every screen and component reads its colours from PreferencesProvider
export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: Providers });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
