import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { api } from './apiClient';

// Must match ANDROID_CHANNEL_ID in apps/api/src/services/pushService.ts.
const ANDROID_CHANNEL_ID = 'default';

// expo-notifications has no push (and no response events) on web, which is
// only a dev preview here anyway.
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// Without this, a push that arrives while the app is open is dropped silently.
// Sound stays on: Android won't show the heads-up banner without it.
if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// The registration in flight or done, resolving to the API's device id.
// Not persisted: the app registers again on every start, and the API treats a
// repeat as the same device.
let registration: Promise<string | null> | null = null;

async function register(): Promise<string | null> {
  // Emulators without Play services and simulators have no push token to give.
  if (!isNative || !Device.isDevice) return null;

  // Android 13+ only shows the permission prompt once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Repository alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    ({ granted } = await Notifications.requestPermissionsAsync());
  }
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId in app.json — run `eas init` in apps/mobile.');
    return null;
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (__DEV__) {
    // Paste into https://expo.dev/notifications to test the phone on its own.
    console.log('[push] Expo push token:', expoPushToken);
  }

  const device = await api.post<{ id: string }>('/api/devices', {
    expoPushToken,
    platform: Platform.OS,
    deviceName: Device.deviceName?.slice(0, 100) ?? undefined,
  });
  return device.id;
}

/**
 * Registers this phone for push with the API. Best effort: where push can't
 * work — web, a refused permission, Expo Go on Android — it does nothing, and
 * the in-app inbox still has every alert.
 */
export function registerForPush(): Promise<void> {
  registration = register().catch((err: unknown) => {
    console.warn('[push] Registration failed:', err);
    return null;
  });
  return registration.then(() => undefined);
}

/**
 * Stops pushes to this phone (logout, or notifications switched off). Waits
 * for a registration still in flight, so a quick on-then-off can't leave the
 * device registered.
 */
export async function unregisterFromPush(): Promise<void> {
  const pending = registration;
  registration = null;

  const deviceId = pending ? await pending : null;
  if (!deviceId) return;

  try {
    await api.delete(`/api/devices/${deviceId}`);
  } catch {
    // A missed unregister costs a few extra pushes: the token moves to the
    // next account that signs in here, or Expo reports it gone.
  }
}

/**
 * Calls `onTap` when the user opens one of our pushes, including the tap that
 * launched the app, which happened before any listener existed.
 */
export function onPushTap(onTap: () => void): () => void {
  if (!isNative) return () => {};

  const handle = (response: Notifications.NotificationResponse | null) => {
    if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    onTap();
    // Otherwise the next ordinary launch finds it again and jumps to the inbox.
    Notifications.clearLastNotificationResponse();
  };

  handle(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

/** Calls `listener` when a push arrives while the app is open, or is tapped. */
export function onPushActivity(listener: () => void): () => void {
  if (!isNative) return () => {};

  const received = Notifications.addNotificationReceivedListener(listener);
  const tapped = Notifications.addNotificationResponseReceivedListener(listener);
  return () => {
    received.remove();
    tapped.remove();
  };
}
