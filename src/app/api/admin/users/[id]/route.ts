import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { equipos, usuarios } from '@/lib/db/schema';
import { countAdminUsers, getAdminUserById } from '@/lib/admin/users';
import { UpdateUserSchema } from '@/lib/schemas/user';

type Params = { params: Promise<{ id: string }> };

async function requireAdminSession() {
  const session = await getAuthSession();

  if (!session?.user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  if (session.user.rol !== 'admin') {
    return { error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) };
  }

  return { session };
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const user = await getAdminUserById(id);

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const existing = await db.select().from(usuarios).where(eq(usuarios.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  if (parsed.data.rol && parsed.data.rol !== existing.rol && auth.session.user.id === id) {
    return NextResponse.json(
      { code: 'SELF_ROLE_CHANGE', error: 'No puedes cambiar tu propio rol' },
      { status: 403 }
    );
  }

  if (
    parsed.data.rol &&
    existing.rol === 'admin' &&
    parsed.data.rol !== 'admin'
  ) {
    const adminCount = await countAdminUsers();
    if (adminCount <= 1) {
      return NextResponse.json(
        { code: 'ULTIMO_ADMIN', error: 'No se puede degradar al último administrador' },
        { status: 409 }
      );
    }
  }

  if (parsed.data.nombre === undefined && parsed.data.rol === undefined) {
    const user = await getAdminUserById(id);
    return NextResponse.json(user);
  }

  await db
    .update(usuarios)
    .set({
      ...(parsed.data.nombre !== undefined ? { nombre: parsed.data.nombre } : {}),
      ...(parsed.data.rol !== undefined ? { rol: parsed.data.rol } : {}),
    })
    .where(eq(usuarios.id, id));

  const updated = await getAdminUserById(id);
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await db.select().from(usuarios).where(eq(usuarios.id, id)).get();

  if (!existing) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  if (auth.session.user.id === id) {
    return NextResponse.json(
      { code: 'SELF_DELETE', error: 'No puedes eliminar tu propio usuario' },
      { status: 403 }
    );
  }

  if (existing.rol === 'admin') {
    const adminCount = await countAdminUsers();
    if (adminCount <= 1) {
      return NextResponse.json(
        { code: 'ULTIMO_ADMIN', error: 'No se puede eliminar el último administrador' },
        { status: 409 }
      );
    }
  }

  const ownedTeam = await db
    .select({ id: equipos.id })
    .from(equipos)
    .where(eq(equipos.usuarioId, id))
    .get();

  if (ownedTeam) {
    return NextResponse.json(
      {
        code: 'USUARIO_CON_EQUIPO',
        error: 'El usuario tiene un equipo registrado. Elimina el equipo primero.',
      },
      { status: 409 }
    );
  }

  await db.delete(usuarios).where(eq(usuarios.id, id));
  return new Response(null, { status: 204 });
}
