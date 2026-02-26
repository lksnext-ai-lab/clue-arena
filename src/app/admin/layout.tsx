import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled } from '@/lib/auth/dev';
import { cookies } from 'next/headers';
import { DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isAuthDisabled()) {
    const cookieStore = await cookies();
    const devRole = cookieStore.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    if (!devRole || !DEV_USERS[devRole] || DEV_USERS[devRole].rol !== 'admin') {
      redirect('/login');
    }
  } else {
    const session = await auth();
    if (!session?.user || (session.user as any).rol !== 'admin') {
      redirect('/login');
    }
  }

  return (
    <div className="dark min-h-screen bg-slate-900 text-white">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
