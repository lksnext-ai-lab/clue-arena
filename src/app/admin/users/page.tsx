import { getTranslations } from 'next-intl/server';
import { AdminUsersSection } from '@/components/admin/AdminUsersSection';
import { getAuthSession } from '@/lib/auth/session';
import { listAdminUsers } from '@/lib/admin/users';

export default async function AdminUsersPage() {
  const [t, session, initialUsers] = await Promise.all([
    getTranslations('admin'),
    getAuthSession(),
    listAdminUsers(),
  ]);

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: 'radial-gradient(circle at top, #17304a 0%, #07111d 46%, #04070d 100%)' }}
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
            style={{ background: 'linear-gradient(160deg, rgba(34,211,238,0.12), rgba(244,63,94,0.08) 62%, transparent)' }}
          >
            <div
              className="absolute -left-16 top-0 h-40 w-40 rounded-full blur-3xl"
              style={{ background: 'rgba(34,211,238,0.14)' }}
            />
            <div
              className="absolute bottom-0 right-0 h-32 w-32 rounded-full blur-3xl"
              style={{ background: 'rgba(244,63,94,0.1)' }}
            />

            <div className="relative max-w-4xl space-y-4">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                style={{ background: 'rgba(34,211,238,0.14)', color: '#67e8f9' }}
              >
                {t('gestionUsuariosEyebrow')}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: '#f8fafc' }}>
                  {t('gestionUsuarios')}
                </h1>
                <p className="max-w-3xl text-sm leading-6 sm:text-base" style={{ color: '#cbd5e1' }}>
                  {t('gestionUsuariosHeroDesc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <AdminUsersSection
          currentUserId={session?.user?.id ?? null}
          initialUsers={initialUsers}
        />
      </div>
    </div>
  );
}
