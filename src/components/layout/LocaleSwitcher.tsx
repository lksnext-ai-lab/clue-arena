'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ACTIVE_LOCALES, type Locale } from '@/i18n/locales';

const LOCALE_LABELS: Record<Locale, string> = {
  es: 'ES',
  eu: 'EU',
  en: 'EN',
};

export function LocaleSwitcher() {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(locale: Locale) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {ACTIVE_LOCALES.map((locale) => (
        <button
          key={locale}
          data-testid={`locale-switcher-${locale}`}
          onClick={() => switchLocale(locale)}
          disabled={isPending || locale === currentLocale}
          style={{
            padding: '2px 7px',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 6,
            border: 'none',
            cursor: locale === currentLocale ? 'default' : 'pointer',
            letterSpacing: 0.5,
            transition: 'all 0.15s',
            background: locale === currentLocale ? '#22d3ee' : 'transparent',
            color: locale === currentLocale ? '#0a0a0f' : '#64748b',
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
