import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export interface DevicePlace {
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  village: string;
}

/** One tap fills state/district/village from GPS, so farmers do not have to type them. */
export function useDeviceLocation() {
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  const locate = useCallback(async (): Promise<DevicePlace | null> => {
    setLocating(true);
    setDenied(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        return null;
      }
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude, longitude } = position.coords;
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      return {
        latitude: Number(latitude.toFixed(4)),
        longitude: Number(longitude.toFixed(4)),
        state: address?.region ?? '',
        district: address?.subregion ?? address?.district ?? '',
        village: address?.city ?? '',
      };
    } catch {
      return null;
    } finally {
      setLocating(false);
    }
  }, []);

  return { locate, locating, denied };
}
