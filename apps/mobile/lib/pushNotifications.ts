import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { api } from './apiClient';

// must match the API's channel id
const ANDROID_CHANNEL_ID = 'default';

// no push on web
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// show pushes while the app is open. android needs sound for the banner
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

// resolves to the API's device id
let registration: Promise<string | null> | null = null;

async function register(): Promise<string | null> {
  // emulators have no push token
  if (!isNative || !Device.isDevice) return null;

  // android 13+ needs a channel before asking
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
    // test at https://expo.dev/notifications
    console.log('[push] Expo push token:', expoPushToken);
  }

  const device = await api.post<{ id: string }>('/api/devices', {
    expoPushToken,
    platform: Platform.OS,
    deviceName: Device.deviceName?.slice(0, 100) ?? undefined,
  });
  return device.id;
}

// best effort, does nothing where push isn't available
export function registerForPush(): Promise<void> {
  registration = register().catch((err: unknown) => {
    console.warn('[push] Registration failed:', err);
    return null;
  });
  return registration.then(() => undefined);
}

// waits for any registration in flight first
export async function unregisterFromPush(): Promise<void> {
  const pending = registration;
  registration = null;

  const deviceId = pending ? await pending : null;
  if (!deviceId) return;

  try {
    await api.delete(`/api/devices/${deviceId}`);
  } catch {
    // not a big deal if this fails
  }
}

// includes the tap that launched the app
export function onPushTap(onTap: (data: Record<string, unknown>) => void): () => void {
  if (!isNative) return () => {};

  const handle = (response: Notifications.NotificationResponse | null) => {
    if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    onTap(response.notification.request.content.data ?? {});
    // or the next launch would handle it again
    Notifications.clearLastNotificationResponse();
  };

  handle(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

export function onPushActivity(listener: () => void): () => void {
  if (!isNative) return () => {};

  const received = Notifications.addNotificationReceivedListener(listener);
  const tapped = Notifications.addNotificationResponseReceivedListener(listener);
  return () => {
    received.remove();
    tapped.remove();
  };
}
