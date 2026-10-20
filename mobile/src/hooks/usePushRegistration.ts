import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushToken } from '@/api/hooks';

type NotificationsModule = typeof import('expo-notifications');

// Expo Go (SDK 53+) throws as soon as expo-notifications is imported on Android, so the
// module is loaded only in development and production builds, never at import time.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let notifications: NotificationsModule | null | undefined;

function loadNotifications(): NotificationsModule | null {
  if (notifications !== undefined) return notifications;
  if (inExpoGo) return (notifications = null);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module: NotificationsModule = require('expo-notifications');
  module.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  return (notifications = module);
}

/**
 * Registers this phone for targeted alerts (weather, schemes, farm tasks). Silent no-op
 * on simulators, in Expo Go, or when the project has no EAS project id yet; farmers
 * without push still receive SMS from the backend and see alerts in the app's inbox.
 */
export function usePushRegistration(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !Device.isDevice) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const Notifications = loadNotifications();
    if (!Notifications) return;
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'Farm alerts',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const { granted } = await Notifications.requestPermissionsAsync();
      if (!granted) return;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushToken(data);
    })().catch(() => undefined);
  }, [enabled]);
}
