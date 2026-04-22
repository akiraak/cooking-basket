import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'device_id_fallback';

let cachedId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;

  if (Platform.OS === 'ios') {
    const idfv = await Application.getIosIdForVendorAsync();
    if (idfv) {
      cachedId = idfv;
      return idfv;
    }
  } else if (Platform.OS === 'android') {
    const androidId = Application.getAndroidId();
    if (androidId) {
      cachedId = androidId;
      return androidId;
    }
  }

  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) {
    cachedId = stored;
    return stored;
  }

  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  cachedId = generated;
  return generated;
}

export function __resetDeviceIdCacheForTests(): void {
  cachedId = null;
}
