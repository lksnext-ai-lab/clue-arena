import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ACTIVE_LOCALES, DEFAULT_LOCALE, type Locale } from './locales';

export type { Locale };
export { SUPPORTED_LOCALES, ACTIVE_LOCALES, DEFAULT_LOCALE } from './locales';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;

  // Fallback to default locale if cookie is absent or invalid
  const locale: Locale = ACTIVE_LOCALES.includes(cookieValue as Locale)
    ? (cookieValue as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
