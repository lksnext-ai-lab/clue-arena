/**
 * POST /api/teams/[id]/avatar
 *
 * Two modes (differentiated by Content-Type):
 *  - application/json  → { action: 'generate' }   → calls Genkit image model
 *  - multipart/form-data → file field 'avatar'     → uploads user-provided image
 *
 * Both actions:
 *  - Require admin role.
 *  - Save the image to public/avatars/<teamId>.<ext>.
 *  - Update equipos.avatar_url in the DB.
 *  - Return { avatarUrl: string }.
 */
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { equipos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateTeamAvatar } from '@/lib/ai/flows/generate-avatar';

const AVATARS_DIR = path.join(process.cwd(), 'public', 'avatars');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const team = await db.select().from(equipos).where(eq(equipos.id, id)).get();
  if (!team) {
    return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
  }

  const contentType = request.headers.get('content-type') ?? '';

  // ── Generate mode ──────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    let avatarUrl: string;
    try {
      avatarUrl = await generateTeamAvatar(id, team.nombre, team.descripcion);
    } catch (err) {
      console.error('[avatar/generate] Genkit error:', err);
      return NextResponse.json(
        { error: 'Error al generar el avatar con IA' },
        { status: 500 }
      );
    }

    await db.update(equipos).set({ avatarUrl }).where(eq(equipos.id, id));
    return NextResponse.json({ avatarUrl });
  }

  // ── Upload mode (multipart/form-data) ──────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Error al parsear el formulario' }, { status: 400 });
    }

    const file = formData.get('avatar');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Campo "avatar" requerido' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'La imagen no puede superar 5 MB' }, { status: 400 });
    }

    const ext = file.type.split('/')[1] ?? 'png';
    const filename = `${id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await fs.mkdir(AVATARS_DIR, { recursive: true });
    await fs.writeFile(path.join(AVATARS_DIR, filename), buffer);

    const avatarUrl = `/avatars/${filename}`;
    await db.update(equipos).set({ avatarUrl }).where(eq(equipos.id, id));

    return NextResponse.json({ avatarUrl });
  }

  return NextResponse.json({ error: 'Content-Type no soportado' }, { status: 415 });
}
