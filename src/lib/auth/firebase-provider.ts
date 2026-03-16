const DEFAULT_FIREBASE_AUTH_PROVIDERS = ['password', 'google.com'] as const;

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getFirebaseAuthProviderId(): string {
  return getFirebaseAuthProviderIds()[0] ?? DEFAULT_FIREBASE_AUTH_PROVIDERS[0];
}

export function getFirebaseAuthProviderIds(): string[] {
  const rawValue = process.env.NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER?.trim();

  if (!rawValue) {
    return [...DEFAULT_FIREBASE_AUTH_PROVIDERS];
  }

  const providerIds = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return providerIds.length > 0 ? providerIds : [...DEFAULT_FIREBASE_AUTH_PROVIDERS];
}

export function getFirebaseAuthProviderLabel(providerId = getFirebaseAuthProviderId()): string {
  switch (providerId) {
    case 'password':
      return 'Email/password';
    case 'google.com':
      return 'Google';
    case 'microsoft.com':
      return 'Microsoft';
    case 'github.com':
      return 'GitHub';
    case 'apple.com':
      return 'Apple';
    case 'facebook.com':
      return 'Facebook';
    case 'twitter.com':
      return 'X';
    case 'yahoo.com':
      return 'Yahoo';
    case 'phone':
      return 'Phone';
    default:
      return toTitleCase(providerId.replace(/\.com$/i, '').replace(/[._-]+/g, ' '));
  }
}
