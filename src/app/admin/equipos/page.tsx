import { getTranslations } from 'next-intl/server';
import { AdminTeamsSection } from '@/components/admin/AdminTeamsSection';

/**
 * UI-006 /equipos sub-page — Team Management
 */
export default async function AdminEquiposPage() {
  const t = await getTranslations('admin');

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: 'radial-gradient(circle at top, #1f3b57 0%, #08111d 48%, #05080d 100%)' }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section
          className="overflow-hidden rounded-[30px] border"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.18)',
            background: 'linear-gradient(145deg, rgba(9,17,31,0.98), rgba(15,23,42,0.94))',
            boxShadow: '0 32px 80px rgba(2, 6, 23, 0.5)',
          }}
        >
          <div
            className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10"
            style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.1), rgba(34,197,94,0.06) 62%, transparent)' }}
          >
            <div
              className="absolute -left-16 top-0 h-40 w-40 rounded-full blur-3xl"
              style={{ background: 'rgba(245,158,11,0.14)' }}
            />
            <div
              className="absolute bottom-0 right-0 h-32 w-32 rounded-full blur-3xl"
              style={{ background: 'rgba(34,197,94,0.08)' }}
            />

            <div className="relative max-w-4xl space-y-4">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}
              >
                {t('gestionEquiposEyebrow')}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: '#f8fafc' }}>
                  {t('gestionEquipos')}
                </h1>
                <p className="max-w-3xl text-sm leading-6 sm:text-base" style={{ color: '#cbd5e1' }}>
                  {t('gestionEquiposHeroDesc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <AdminTeamsSection />
      </div>
    </div>
  );
}
