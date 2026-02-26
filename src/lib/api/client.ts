import { ForbiddenError, ServerError } from '@/lib/utils/errors';

type ApiOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuth: _skip, ...fetchOptions } = options;

  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    credentials: 'include', // sends httpOnly session cookie
    ...fetchOptions,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (res.status === 403) {
    throw new ForbiddenError();
  }

  if (!res.ok) {
    throw new ServerError(res.status, await res.text());
  }

  return res.json() as Promise<T>;
}
