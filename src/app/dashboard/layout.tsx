import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled } from '@/lib/auth/dev';
import { cookies } from 'next/headers';
import { DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dev-mode bypass
  if (isAuthDisabled()) {
    const cookieStore = await cookies();
    const devRole = cookieStore.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    if (!devRole || !DEV_USERS[devRole]) {
      redirect('/login');
    }
  } else {
    const session = await auth();
    if (!session?.user) {
      redirect('/login');
    }
  }

  return (
    <div className="dark min-h-screen bg-slate-900 text-white">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
