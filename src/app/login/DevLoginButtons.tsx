'use client';

import { useTranslations } from 'next-intl';
import { DEV_COOKIE } from '@/lib/auth/dev';

/**
 * Dev-mode only: buttons to log in as a predefined role without OIDC.
 * Rendered only when DISABLE_AUTH=true (checked in LoginPage server component).
 */
export default function DevLoginButtons() {
  const t = useTranslations('auth');

  function loginAs(role: 'admin' | 'equipo') {
    document.cookie = `${DEV_COOKIE}=${role}; path=/; max-age=86400; SameSite=Lax`;
    window.location.href = '/';
  }

  return (
    <div className="mt-6 border-t pt-6 space-y-3" style={{ borderColor: '#1e293b' }}>
      <p className="text-xs font-mono" style={{ color: '#f59e0b' }}>
        {t('devMode')}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => loginAs('admin')}
          className="px-5 py-2 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80"
          style={{ borderColor: '#f59e0b', color: '#f59e0b', background: 'transparent' }}
        >
          {t('entrarAdmin')}
        </button>
        <button
          onClick={() => loginAs('equipo')}
          className="px-5 py-2 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80"
          style={{ borderColor: '#94a3b8', color: '#94a3b8', background: 'transparent' }}
        >
          {t('entrarEquipo')}
        </button>
      </div>
    </div>
  );
}
