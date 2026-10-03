// shared by every test file. native modules don't exist in node, so they're faked here

import { setAccessToken } from '../lib/authTokenStore';
import { apiMock, clearSecureStore } from './utils';

// in-memory, cleared between tests
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  WebBrowserResultType: jest.requireActual('expo-web-browser/build/WebBrowser.types')
    .WebBrowserResultType,
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `codehealth://${path}`),
  parse: jest.fn(),
}));

// push needs a real device
jest.mock('../lib/pushNotifications', () => ({
  registerForPush: jest.fn(async () => {}),
  unregisterFromPush: jest.fn(async () => {}),
  onPushTap: jest.fn(() => () => {}),
  onPushActivity: jest.fn(() => () => {}),
}));

// the onboarding overlay would cover every screen
jest.mock('../components/ScreenTour', () => ({ ScreenTour: () => null }));

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

afterEach(() => {
  apiMock.reset();
  setAccessToken(null);
  clearSecureStore();
});
