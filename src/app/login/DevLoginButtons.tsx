'use client';

import { useTranslations } from 'next-intl';
import { DEV_COOKIE } from '@/lib/auth/dev';

/**
 * Dev-mode only: buttons to log in as a predefined role without OIDC.
 * Rendered only when DISABLE_AUTH=true (checked in LoginPage server component).
 */
export default function DevLoginButtons() {
  const t = useTranslations('auth');

  function loginAs(role: 'admin' | 'equipo' | 'sinEquipo') {
    document.cookie = `${DEV_COOKIE}=${role}; path=/; max-age=86400; SameSite=Lax`;
    window.location.href = '/';
  }

  return (
    <div className="mt-6 border-t border-slate-800 pt-6 space-y-3">
      <p className="text-xs font-mono text-amber-500">
        {t('devMode')}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => loginAs('admin')}
          className="px-5 py-2 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80 border-cyan-500 text-cyan-400 bg-transparent hover:bg-cyan-500/10"
        >
          {t('entrarAdmin')}
        </button>
        <button
          onClick={() => loginAs('equipo')}
          className="px-5 py-2 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80 border-slate-500 text-slate-400 bg-transparent hover:bg-slate-700"
        >
          {t('entrarEquipo')}
        </button>
        <button
          onClick={() => loginAs('sinEquipo')}
          className="px-5 py-2 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80 border-slate-600 text-slate-500 bg-transparent hover:bg-slate-700"
        >
          {t('entrarSinEquipo')}
        </button>
      </div>
    </div>
  );
}
