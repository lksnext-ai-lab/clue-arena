import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento } from '@/lib/db/schema';

type CleanupScope = 'all';

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'equipo') {
    return NextResponse.json(
      { error: 'Solo los equipos pueden limpiar partidas de entrenamiento' },
      { status: 403 },
    );
  }

  const teamId = session.user.equipo?.id;
  if (!teamId) {
    return NextResponse.json({ error: 'Equipo no configurado' }, { status: 400 });
  }

  let scope: CleanupScope | null = null;
  try {
    const body = (await request.json()) as { scope?: CleanupScope };
    scope = body.scope ?? null;
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  if (scope !== 'all') {
    return NextResponse.json({ error: 'Scope inválido' }, { status: 422 });
  }

  const targetIds = (
    await db
      .select({ id: partidasEntrenamiento.id })
      .from(partidasEntrenamiento)
      .where(
        and(
          eq(partidasEntrenamiento.equipoId, teamId),
          inArray(partidasEntrenamiento.estado, ['finalizada', 'abortada']),
        ),
      )
      .all()
  ).map((game) => game.id);

  if (targetIds.length === 0) {
    return NextResponse.json({ success: true, deleted: 0, scope });
  }

  await db.delete(partidasEntrenamiento).where(inArray(partidasEntrenamiento.id, targetIds));

  return NextResponse.json({ success: true, deleted: targetIds.length, scope });
}
