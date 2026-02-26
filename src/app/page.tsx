import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth/config';
import { DEV_COOKIE, DEV_USERS, isAuthDisabled } from '@/lib/auth/dev';

/**
 * UI-000: Root redirect.
 * All authenticated users → /dashboard
 * Unauthenticated → /login
 */
export default async function RootPage() {
  // Dev-mode bypass: read the dev-role cookie set by DevLoginButtons
  if (isAuthDisabled()) {
    const cookieStore = await cookies();
    const devRole = cookieStore.get(DEV_COOKIE)?.value as keyof typeof DEV_USERS | undefined;
    if (!devRole || !DEV_USERS[devRole]) {
      redirect('/login');
    }
    redirect('/dashboard');
  }

  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  redirect('/dashboard');
}
