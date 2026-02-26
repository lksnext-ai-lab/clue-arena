import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { signOut } from '@/lib/auth/config';
import { getTranslations } from 'next-intl/server';

interface AppShellProps {
  children: React.ReactNode;
}

export async function AppShell({ children }: AppShellProps) {
  const session = await auth();
  const rol = (session?.user as any)?.rol;
  const tNav = await getTranslations('nav');
  const tCommon = await getTranslations('common');

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f', color: '#f1f5f9' }}>
      <nav
        className="border-b px-6 py-3 flex items-center justify-between"
        style={{ borderColor: '#1e293b', background: '#1a1a2e' }}
      >
        <Link
          href="/"
          className="font-bold tracking-wide"
          style={{ color: '#f59e0b', fontFamily: 'Georgia, serif' }}
        >
          Clue Arena
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/ranking" style={{ color: '#94a3b8' }} className="hover:text-white transition-colors">
            {tNav('ranking')}
          </Link>
          {rol === 'admin' && (
            <Link href="/admin" style={{ color: '#94a3b8' }} className="hover:text-white transition-colors">
              {tNav('admin')}
            </Link>
          )}
          {rol === 'equipo' && (
            <Link href="/equipo" style={{ color: '#94a3b8' }} className="hover:text-white transition-colors">
              {tNav('miEquipo')}
            </Link>
          )}
          {session?.user && (
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="text-xs px-3 py-1 rounded-md"
                style={{ background: '#334155', color: '#f1f5f9' }}
              >
                {tCommon('cerrarSesion')}
              </button>
            </form>
          )}
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}
