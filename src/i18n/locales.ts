/** Locale constants — safe to import from both Server and Client Components. */

export const SUPPORTED_LOCALES = ['es', 'eu', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Locales active in MVP; 'en' has no translations yet. */
export const ACTIVE_LOCALES: Locale[] = ['es', 'eu'];
export const DEFAULT_LOCALE: Locale = 'es';
