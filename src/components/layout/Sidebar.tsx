'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Swords,
  Trophy,
  Medal,
  User,
  BookOpen,
  Bot,
  Dumbbell,
} from 'lucide-react';
import { useAppSession } from '@/contexts/SessionContext';
import { LocaleSwitcher } from './LocaleSwitcher';

// --- Design tokens (inline styles used throughout to bypass Tailwind compile issues) ---
const BG_SIDEBAR = '#020617';
const BORDER_SIDEBAR = '#1e293b';
const ACCENT = '#22d3ee';
const ACCENT_BG = 'rgba(34,211,238,0.12)';
const ACCENT_BORDER = 'rgba(34,211,238,0.25)';
const TEXT_MUTED = '#64748b';
const TEXT_ACTIVE = '#f1f5f9';

type NavKey = 'dashboard' | 'miEquipo' | 'admin' | 'arena' | 'juego' | 'ranking' | 'instrucciones' | 'entrenamiento' | 'perfil' | 'equipos' | 'partidas' | 'torneos' | 'usuarios';

interface NavItem {
  href: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  labelKey: NavKey;
  roles: Array<'admin' | 'equipo' | 'espectador'>;
  requiresTeam?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  // Public items
  { href: '/', Icon: LayoutDashboard, labelKey: 'dashboard', roles: ['admin', 'equipo', 'espectador'] },
  { href: '/acerca-del-juego', Icon: BookOpen,        labelKey: 'juego',         roles: ['admin', 'equipo', 'espectador'] },
  { href: '/instrucciones',   Icon: Bot,             labelKey: 'instrucciones', roles: ['admin', 'equipo', 'espectador'] },
  { href: '/arena',           Icon: Swords,          labelKey: 'arena',         roles: ['admin', 'equipo', 'espectador'] },
  { href: '/ranking',         Icon: Trophy,          labelKey: 'ranking',       roles: ['admin', 'equipo', 'espectador'] },
  
  // Team-specific items
  { href: '/equipo',          Icon: Users,           labelKey: 'miEquipo',       roles: ['equipo'] },
  { href: '/equipo/entrenamiento', Icon: Dumbbell,   labelKey: 'entrenamiento',  roles: ['equipo'], requiresTeam: true },

  // Admin-specific items
  { href: '/admin',           Icon: LayoutDashboard, labelKey: 'admin',     roles: ['admin'] },
  { href: '/admin/equipos',   Icon: Users,           labelKey: 'equipos',   roles: ['admin'] },
  { href: '/admin/users',     Icon: User,            labelKey: 'usuarios',  roles: ['admin'] },
  { href: '/admin/partidas',  Icon: Swords,          labelKey: 'partidas',  roles: ['admin'] },
  { href: '/admin/torneos',   Icon: Medal,           labelKey: 'torneos',   roles: ['admin'] },
];

const BTM_ITEMS: NavItem[] = [
  { href: '/perfil', Icon: User, labelKey: 'perfil', roles: ['admin','equipo','espectador'] },
];

interface SidebarLinkProps extends NavItem {
  label: string;
  active: boolean;
}

function SidebarLink({ href, Icon, label, active }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        width: 52, padding: '9px 0', borderRadius: 10, textDecoration: 'none',
        background: active ? ACCENT_BG : 'transparent',
        border: active ? `1px solid ${ACCENT_BORDER}` : '1px solid transparent',
        color: active ? ACCENT : TEXT_MUTED,
        transition: 'all 0.15s ease',
      }}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4, lineHeight: 1, color: active ? TEXT_ACTIVE : TEXT_MUTED }}>
        {label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { rol, equipo } = useAppSession();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  const isActive = (href: string) => {
    if (href === '/admin' && pathname.startsWith('/admin')) return true;
    if (href === '/' && pathname !== '/') return false;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return pathname === href;
  }
  
  const effectiveRole = rol ?? 'espectador';
  const hasTeam = Boolean(equipo?.id);

  const mainNav = ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(effectiveRole)) {
      return false;
    }

    if (item.requiresTeam && !hasTeam) {
      return false;
    }

    return true;
  });
  const bottomNav = BTM_ITEMS.filter(i => i.roles.includes(effectiveRole));

  return (
    <nav
      aria-label={tCommon('mainNavigation')}
      style={{
        width: 64, minWidth: 64, background: BG_SIDEBAR,
        borderRight: `1px solid ${BORDER_SIDEBAR}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 0', flexShrink: 0, height: '100vh',
        position: 'sticky', top: 0, overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <Link href="/" aria-label="Clue Arena" style={{
        marginBottom: 20, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Image
          src="/clue-logo.png"
          alt="Clue Arena logo"
          width={36}
          height={38}
          priority
          style={{ width: 36, height: 'auto' }}
        />
      </Link>

      {/* Main nav */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
        {mainNav.map((item) => (
          <SidebarLink key={item.href} {...item} label={t(item.labelKey)} active={isActive(item.href)} />
        ))}
      </div>

      {/* Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {bottomNav.map((item) => (
          <SidebarLink key={item.href} {...item} label={t(item.labelKey)} active={isActive(item.href)} />
        ))}
        <LocaleSwitcher />
      </div>
    </nav>
  );
}
