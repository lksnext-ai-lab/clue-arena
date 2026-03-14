import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAuthSession } from '@/lib/auth/session';
import { User, Shield, Users, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

export default async function PerfilPage() {
  const session = await getAuthSession();
  const t = await getTranslations('perfil');

  // The middleware is responsible for route protection.
  // This page should only be rendered for authenticated users.
  if (!session?.user) {
    // This redirect is a safeguard and should not be reached in normal operation.
    return redirect('/login');
  }

  const { user } = session;

  const ROL_META = {
    admin: { label: t('rolAdmin'), Icon: Shield, color: 'text-cyan-400' },
    equipo: { label: t('rolEquipo'), Icon: Users, color: 'text-emerald-400' },
    espectador: { label: t('rolEspectador'), Icon: User, color: 'text-slate-400' },
  };

  const roleMeta = ROL_META[user.rol ?? 'espectador'];

  return (
    <div className="p-6 max-w-2xl mx-auto text-slate-200">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-cyan-400">{t('titulo')}</h1>
        <p className="text-sm mt-1 text-slate-500">{t('descripcion')}</p>
      </header>

      <div className="space-y-6 rounded-xl border border-slate-700 bg-slate-800 p-6">
        {/* User Info */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
            <User size={32} className="text-slate-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{user.name}</h2>
            <p className="text-sm text-slate-400">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <roleMeta.Icon size={14} className={roleMeta.color} />
              <span className={`text-sm font-medium ${roleMeta.color}`}>{roleMeta.label}</span>
            </div>
          </div>
        </div>

        {/* Team Info */}
        {user.rol === 'equipo' && user.equipo && (
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{t('equipo')}</h3>
            <div className="rounded-lg border border-slate-600 bg-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{user.equipo.nombre}</p>
                  <p className="font-mono text-xs text-slate-500 mt-1">{user.equipo.agentId}</p>
                </div>
                <Link
                  href="/equipo"
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  {t('irAlPanel')} <LinkIcon size={12} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
