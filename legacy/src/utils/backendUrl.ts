// Backend URL utility - handles platform-specific URLs
import { Platform } from 'react-native';

/**
 * Get the backend URL based on platform and environment
 * - Android emulator: uses 10.0.2.2 (special IP to access host machine)
 * - iOS simulator: uses localhost
 * - Physical device: uses environment variable or fallback IP
 * - Web: uses localhost
 */
export const getBackendUrl = (): string => {
  // Platform-specific handling for Android emulator (must use 10.0.2.2)
  if (__DEV__ && Platform.OS === 'android') {
    // Android emulator always needs 10.0.2.2 to access host machine
    // Extract port from env URL if provided, otherwise use default 8080
    const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    let port = '8080';
    if (envUrl && envUrl.includes(':')) {
      const match = envUrl.match(/:(\d+)/);
      if (match) port = match[1];
    }
    return `http://10.0.2.2:${port}`;
  }
  
  // For other platforms, check if EXPO_PUBLIC_BACKEND_URL is set and is a valid URL
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  
  // Validate that it's a proper URL (starts with http:// or https://)
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl;
  }
  
  // Platform-specific fallbacks for development
  if (__DEV__) {
    // iOS simulator or web can use localhost
    return 'http://localhost:8080';
  }
  
  // Production fallback
  return 'https://gemini-backend.agrismart.com';
};

// Export a constant for convenience
export const BACKEND_URL = getBackendUrl();

