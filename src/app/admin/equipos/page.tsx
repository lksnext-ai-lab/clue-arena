import { getTranslations } from 'next-intl/server';
import { AdminTeamsSection } from '@/components/admin/AdminTeamsSection';

/**
 * UI-006 /equipos sub-page — Team Management
 */
export default async function AdminEquiposPage() {
  const t = await getTranslations('admin');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 text-slate-200">
      <header>
        <h1 className="text-3xl font-bold text-cyan-400">
          {t('gestionEquipos')}
        </h1>
        <p className="text-sm mt-1 text-slate-500">
          {t('gestionEquiposDesc')}
        </p>
      </header>

      {/* Teams section — UI-006 */}
      <AdminTeamsSection />
    </div>
  );
}
