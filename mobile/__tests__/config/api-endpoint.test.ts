describe('api-endpoint', () => {
  const ORIGINAL_URL = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (ORIGINAL_URL === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = ORIGINAL_URL;
    }
  });

  function loadModule() {
    let mod!: typeof import('../../src/config/api-endpoint');
    jest.isolateModules(() => {
      mod = require('../../src/config/api-endpoint');
    });
    return mod;
  }

  it('treats unset EXPO_PUBLIC_API_URL as production', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const mod = loadModule();
    expect(mod.API_BASE_URL).toBe('https://basket.chobi.me');
    expect(mod.isLocalServer).toBe(false);
    expect(mod.localServerLabel).toBeNull();
  });

  it('treats explicit production URL as production', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://basket.chobi.me';
    const mod = loadModule();
    expect(mod.isLocalServer).toBe(false);
    expect(mod.localServerLabel).toBeNull();
  });

  it('flags LAN IP as local and exposes host:port label', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:3000';
    const mod = loadModule();
    expect(mod.isLocalServer).toBe(true);
    expect(mod.localServerLabel).toBe('192.168.1.10:3000');
  });

  it('flags localhost as local', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    const mod = loadModule();
    expect(mod.isLocalServer).toBe(true);
    expect(mod.localServerLabel).toBe('localhost:3000');
  });
});
