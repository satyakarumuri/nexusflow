import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from './api.js';

describe('apiPost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends JSON requests with the content type header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      }),
    );

    await apiPost('/api/auth/login', {
      email: 'admin@nexusflow.local',
      password: 'Password123',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/auth/login',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          email: 'admin@nexusflow.local',
          password: 'Password123',
        }),
      }),
    );
  });
});
