import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getDeviceId, __resetDeviceIdCacheForTests } from '../../src/utils/device-id';

const application = Application as jest.Mocked<typeof Application>;
const crypto = Crypto as jest.Mocked<typeof Crypto>;
const secure = SecureStore as jest.Mocked<typeof SecureStore> & { __reset: () => void };

beforeEach(() => {
  jest.clearAllMocks();
  secure.__reset();
  __resetDeviceIdCacheForTests();
});

describe('getDeviceId', () => {
  it('returns IDFV on iOS when available', async () => {
    Platform.OS = 'ios';
    application.getIosIdForVendorAsync.mockResolvedValue('idfv-value');

    const id = await getDeviceId();

    expect(id).toBe('idfv-value');
    expect(application.getIosIdForVendorAsync).toHaveBeenCalled();
  });

  it('returns Android ID on Android when available', async () => {
    Platform.OS = 'android';
    application.getAndroidId.mockReturnValue('android-id-value');

    const id = await getDeviceId();

    expect(id).toBe('android-id-value');
    expect(application.getAndroidId).toHaveBeenCalled();
  });

  it('falls back to a generated UUID persisted in SecureStore when native ID is null', async () => {
    Platform.OS = 'ios';
    application.getIosIdForVendorAsync.mockResolvedValue(null);
    crypto.randomUUID.mockReturnValue('generated-uuid');

    const id = await getDeviceId();

    expect(id).toBe('generated-uuid');
    expect(secure.setItemAsync).toHaveBeenCalledWith('device_id_fallback', 'generated-uuid');
  });

  it('reuses a previously stored fallback UUID across calls', async () => {
    Platform.OS = 'ios';
    application.getIosIdForVendorAsync.mockResolvedValue(null);
    await secure.setItemAsync('device_id_fallback', 'stored-uuid');

    const id = await getDeviceId();

    expect(id).toBe('stored-uuid');
    expect(crypto.randomUUID).not.toHaveBeenCalled();
  });

  it('caches the result between calls', async () => {
    Platform.OS = 'ios';
    application.getIosIdForVendorAsync.mockResolvedValue('idfv-value');

    await getDeviceId();
    await getDeviceId();

    expect(application.getIosIdForVendorAsync).toHaveBeenCalledTimes(1);
  });
});
