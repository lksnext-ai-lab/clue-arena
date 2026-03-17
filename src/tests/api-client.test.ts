import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api/client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined for 204 responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    );

    await expect(apiFetch('/teams/demo-team', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('returns undefined for successful non-json responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      })
    );

    await expect(apiFetch('/health')).resolves.toBeUndefined();
  });
});
