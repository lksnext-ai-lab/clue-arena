'use client';

import { Shield, UserRound, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DEV_COOKIE } from '@/lib/auth/dev';

/**
 * Dev-mode only: buttons to log in as a predefined role without OIDC.
 * Rendered only when DISABLE_AUTH=true (checked in LoginPage server component).
 */
export default function DevLoginButtons() {
  const t = useTranslations('auth');
  const devRoles = [
    {
      role: 'admin' as const,
      label: t('entrarAdmin'),
      Icon: Shield,
      className: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/16',
    },
    {
      role: 'equipo' as const,
      label: t('entrarEquipo'),
      Icon: Users,
      className: 'border-white/12 bg-white/5 text-slate-100 hover:bg-white/10',
    },
    {
      role: 'sinEquipo' as const,
      label: t('entrarSinEquipo'),
      Icon: UserRound,
      className: 'border-white/10 bg-slate-900/70 text-slate-300 hover:bg-slate-800/90',
    },
  ];

  function loginAs(role: 'admin' | 'equipo' | 'sinEquipo') {
    document.cookie = `${DEV_COOKIE}=${role}; path=/; max-age=86400; SameSite=Lax`;
    window.location.href = '/';
  }

  return (
    <div className="mt-6 rounded-[28px] border border-amber-300/14 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(15,23,42,0.42))] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">
        {t('devMode')}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{t('devModeDesc')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {devRoles.map(({ role, label, Icon, className }) => (
          <button
            key={role}
            onClick={() => loginAs(role)}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${className}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
