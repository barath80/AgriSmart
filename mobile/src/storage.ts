import * as SecureStore from 'expo-secure-store';

/** Small key-value store: the device keystore on Android/iOS (see storage.web.ts for web). */
export const storage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};
