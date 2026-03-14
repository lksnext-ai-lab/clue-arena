// GET /api/tournaments — list all tournaments (public)
// POST /api/tournaments — create a tournament (admin only)

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { tournaments } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CreateTournamentSchema } from '@/lib/schemas/tournament-config';

export async function GET() {
  const list = await db
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.createdAt))
    .all();

  return NextResponse.json({
    tournaments: list.map((t) => ({
      id: t.id,
      name: t.name,
      format: t.format,
      status: t.status,
      config: JSON.parse(t.config),
      createdAt: t.createdAt?.toISOString() ?? null,
      startedAt: t.startedAt?.toISOString() ?? null,
      finishedAt: t.finishedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = CreateTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { name, config } = parsed.data;
  const id = uuidv4();
  const now = new Date();

  await db.insert(tournaments).values({
    id,
    name,
    format: config.format,
    status: 'draft',
    config: JSON.stringify(config),
    createdAt: now,
  });

  return NextResponse.json(
    {
      id,
      name,
      format: config.format,
      status: 'draft',
      config,
      createdAt: now.toISOString(),
      startedAt: null,
      finishedAt: null,
    },
    { status: 201 },
  );
}
