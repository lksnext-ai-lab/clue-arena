import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEMO_USERS, isDemoEmail, isDemoMode } from '@/lib/auth/demo';

describe('demo mode helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects demo mode from env', () => {
    vi.stubEnv('DEMO_MODE', 'true');
    expect(isDemoMode()).toBe(true);
  });

  it('recognizes the built-in demo accounts', () => {
    for (const user of DEMO_USERS) {
      expect(isDemoEmail(user.email)).toBe(true);
    }

    expect(isDemoEmail('other@example.com')).toBe(false);
  });
});
