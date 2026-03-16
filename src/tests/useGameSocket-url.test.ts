import { getWsUrl } from '@/lib/utils/useGameSocket';

type WindowLike = {
  location: {
    protocol: string;
    host: string;
  };
};

describe('getWsUrl', () => {
  const originalEnv = process.env;
  const globalWithWindow = globalThis as typeof globalThis & { window?: WindowLike };

  beforeEach(() => {
    // Vitest provides vi global instead of jest
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('uses NEXT_PUBLIC_WS_URL when defined', () => {
    process.env.NEXT_PUBLIC_WS_URL = 'wss://custom.example.com/socket';
    const url = getWsUrl();
    expect(url).toBe('wss://custom.example.com/socket');
  });

  test('falls back to window.location when env var missing', () => {
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete globalWithWindow.window;
    globalWithWindow.window = { location: { protocol: 'https:', host: 'foo.bar' } };
    const url = getWsUrl();
    expect(url).toBe('wss://foo.bar/api/ws');
  });

  test('returns dev default on server without window', () => {
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete globalWithWindow.window;
    const url = getWsUrl();
    expect(url).toBe('ws://localhost:3000/api/ws');
  });
});
