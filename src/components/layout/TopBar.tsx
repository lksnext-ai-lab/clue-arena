'use client';

import { Bell, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAppSession } from '@/contexts/SessionContext';

const S = {
  header: {
    height: 56, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px',
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
  } as React.CSSProperties,
  title: {
    fontSize: 11, fontWeight: 700, letterSpacing: 2,
    color: '#94a3b8', textTransform: 'uppercase' as const,
  },
  actions: { display: 'flex', alignItems: 'center', gap: 4 },
  btn: {
    width: 34, height: 34, border: 'none', cursor: 'pointer', borderRadius: 8,
    background: 'transparent', color: '#64748b',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  } as React.CSSProperties,
};

export function TopBar() {
  const { logout, user } = useAppSession();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');

  return (
    <header style={S.header}>
      <h1 style={S.title}>{t('topBar')}</h1>

      <div style={S.actions}>
        {user && (
          <span style={{ fontSize: 12, color: '#64748b', marginRight: 8 }}>{user.name}</span>
        )}
        <button aria-label="Notificaciones" style={S.btn}>
          <Bell size={16} />
        </button>
        <button aria-label={tCommon('cerrarSesion')} onClick={logout} style={S.btn}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
