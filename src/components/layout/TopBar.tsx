'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAppSession } from '@/contexts/SessionContext';
import { NotificationBell } from '@/components/layout/NotificationPanel';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

function getPageTitle(pathname: string, t: (key: string) => string): string {
  if (pathname === '/') return t('landing');
  if (pathname.startsWith('/admin/partidas/nueva')) return t('nuevaPartida');
  if (pathname.startsWith('/admin/partidas/')) return t('adminPartidaDetalle');
  if (pathname.startsWith('/admin/partidas')) return t('adminPartidas');
  if (pathname.startsWith('/admin/equipos')) return t('adminEquipos');
  if (pathname.startsWith('/admin')) return t('admin');
  if (pathname.startsWith('/equipo/entrenamiento')) return t('entrenamiento');
  if (pathname.startsWith('/equipo')) return t('equipo');
  if (pathname.startsWith('/partidas')) return t('arena');
  if (pathname.startsWith('/ranking')) return t('ranking');
  if (pathname.startsWith('/instrucciones')) return t('instrucciones');
  if (pathname.startsWith('/acerca-del-juego')) return t('acerca-del-juego');
  if (pathname.startsWith('/creditos')) return t('creditos');
  if (pathname.startsWith('/perfil')) return t('perfil');

  return t('dashboard'); // fallback
}

export function TopBar() {
  const { logout, user } = useAppSession();
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const tTitles = useTranslations('pageTitles');
  const pathname = usePathname();

  const title = getPageTitle(pathname, tTitles);
  const creditsActive = pathname.startsWith('/creditos');

  return (
    <header style={S.header}>
      <h1 style={S.title}>{title}</h1>

      <div style={S.actions}>
        <Link
          href="/creditos"
          aria-current={creditsActive ? 'page' : undefined}
          className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
        >
          {tNav('creditos')}
        </Link>

        {user ? (
          <>
            <span style={{ fontSize: 12, color: '#64748b', marginRight: 8 }}>{user.name}</span>
            <NotificationBell />
            <button aria-label={tCommon('cerrarSesion')} onClick={logout} style={S.btn}>
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <Link href="/login" className="inline-flex h-9 items-center justify-center rounded-md border border-cyan-500/50 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20">
            {tCommon('acceder')}
          </Link>
        )}
      </div>
    </header>
  );
}
