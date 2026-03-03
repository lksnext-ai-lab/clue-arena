/**
 * seedDevUsers — inserta los usuarios ficticios de DEV_USERS en la BD local.
 *
 * Solo debe ejecutarse cuando DISABLE_AUTH=true (dev mode).
 * Es idempotente: usa onConflictDoNothing para no sobreescribir datos existentes.
 */
import { db } from './index';
import { usuarios } from './schema';
import { DEV_USERS } from '@/lib/auth/dev';

export async function seedDevUsers() {
  const entries = Object.values(DEV_USERS);

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

  console.log(
    `> [seed] Usuarios dev insertados (${entries.length}): ${entries.map((u) => u.email).join(', ')}`,
  );
}

// Punto de entrada cuando se ejecuta directamente: npm run db:seed
if (require.main === module) {
  seedDevUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('> [seed] Error:', err);
      process.exit(1);
    });
}
