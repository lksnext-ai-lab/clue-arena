import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { isAuthDisabled } from '@/lib/auth/dev';
import { cookies } from 'next/headers';
import { DEV_COOKIE, DEV_USERS } from '@/lib/auth/dev';

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
    if (!session?.user || session.user.rol !== 'admin') {
      redirect('/login');
    }
  }

  // The DashboardShell is provided by a higher-level layout (RootShell)
  // This layout only needs to enforce the admin role check.
  return <>{children}</>;
}
