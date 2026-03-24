/**
 * runtime-config.ts — Client-only module.
 *
 * Exposes all NEXT_PUBLIC_* variables that need to be available at runtime,
 * regardless of whether they were baked into the bundle at build time.
 *
 * Strategy:
 *   1. Bootstrap immediately with any build-time values (may be empty in CI/K8s).
 *   2. On first access, fetch /api/config from the server (reads real process.env
 *      from the running pod, populated by ConfigMap / Helm values).
 *   3. Cache the promise at module level — only one network request ever fires.
 *
 * Both RuntimeConfigContext and firebase-client.ts import from this module so
 * there is a single fetch shared across all consumers.
 */

export interface PublicConfig {
  NEXT_PUBLIC_DISABLE_AUTH: string;
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_WS_URL: string;
}

/** Values baked in at build time (empty strings when built without env vars). */
export function getStaticConfig(): PublicConfig {
  return {
    NEXT_PUBLIC_DISABLE_AUTH: process.env.NEXT_PUBLIC_DISABLE_AUTH ?? '',
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER: process.env.NEXT_PUBLIC_FIREBASE_AUTH_PROVIDER ?? '',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? '',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? '',
  };
}

/** Returns true if critical Firebase vars have a non-empty build-time value. */
export function hasStaticFirebaseConfig(config: PublicConfig): boolean {
  return Boolean(
    config.NEXT_PUBLIC_FIREBASE_API_KEY &&
      config.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      config.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      config.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

// Module-level singleton — survives across React re-renders and hot reloads.
let configPromise: Promise<PublicConfig> | null = null;

/**
 * Fetches runtime config from /api/config exactly once (cached at module level).
 * Falls back to the static build-time config on network error.
 */
export function fetchRuntimeConfig(): Promise<PublicConfig> {
  if (!configPromise) {
    configPromise = (async () => {
      const staticConfig = getStaticConfig();
      try {
        const response = await fetch('/api/config', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`/api/config responded ${response.status}`);
        }
        const dynamic = (await response.json()) as Partial<PublicConfig>;
        // Merge: dynamic values override static (empty) ones.
        return { ...staticConfig, ...Object.fromEntries(
          Object.entries(dynamic).filter(([, v]) => v !== ''),
        ) } as PublicConfig;
      } catch (error) {
        console.warn('[RuntimeConfig] Failed to load dynamic config, using build-time values:', error);
        // Allow retry on next call if this was a transient error.
        configPromise = null;
        return staticConfig;
      }
    })();
  }
  return configPromise;
}
