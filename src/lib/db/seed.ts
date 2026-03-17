import { db } from './index';
import { usuarios } from './schema';
import { DEV_USERS } from '@/lib/auth/dev';
import { DEMO_PASSWORD, DEMO_USERS, isDemoMode } from '@/lib/auth/demo';
import { getFirebaseAdminApp } from '@/lib/auth/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

async function seedUsersInDatabase(
  entries: ReadonlyArray<{
    id: string;
    email: string;
    name: string;
    rol: 'admin' | 'equipo' | 'espectador';
  }>,
) {
  for (const user of entries) {
    await db
      .insert(usuarios)
      .values({
        id: user.id,
        email: user.email,
        nombre: user.name,
        rol: user.rol,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
}

export async function seedDevUsers() {
  const entries = Object.values(DEV_USERS);
  await seedUsersInDatabase(entries);

  console.log(
    `> [seed] Usuarios dev insertados (${entries.length}): ${entries.map((u) => u.email).join(', ')}`,
  );
}

async function ensureFirebaseDemoUsers() {
  const auth = getAuth(getFirebaseAdminApp());

  for (const user of DEMO_USERS) {
    try {
      const existingUser = await auth.getUserByEmail(user.email);
      await auth.updateUser(existingUser.uid, {
        displayName: user.name,
        emailVerified: true,
        password: DEMO_PASSWORD,
      });
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (code !== 'auth/user-not-found') {
        throw error;
      }

      await auth.createUser({
        uid: user.id,
        email: user.email,
        displayName: user.name,
        emailVerified: true,
        password: DEMO_PASSWORD,
      });
    }
  }

  console.log(
    `> [seed] Usuarios demo en Firebase Authentication listos (${DEMO_USERS.length}): ${DEMO_USERS
      .map((user) => user.email)
      .join(', ')}`,
  );
}

export async function seedDemoUsers() {
  await seedUsersInDatabase(DEMO_USERS);
  console.log(
    `> [seed] Usuarios demo insertados en BD (${DEMO_USERS.length}): ${DEMO_USERS
      .map((user) => user.email)
      .join(', ')}`,
  );

  await ensureFirebaseDemoUsers();
}

// Punto de entrada cuando se ejecuta directamente: npm run db:seed
if (require.main === module) {
  const seedOperation = isDemoMode() ? seedDemoUsers : seedDevUsers;

  seedOperation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('> [seed] Error:', err);
      process.exit(1);
    });
}
