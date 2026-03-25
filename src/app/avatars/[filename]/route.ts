import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const AVATARS_DIR = path.join(process.cwd(), 'public', 'avatars');

const CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

type Params = { params: Promise<{ filename: string }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: Params) {
  const { filename } = await params;

  // Reject path traversal and nested paths. Avatar filenames are flat.
  if (!filename || filename !== path.basename(filename) || filename.includes('/')) {
    return NextResponse.json({ error: 'Archivo no valido' }, { status: 400 });
  }

  const filePath = path.join(AVATARS_DIR, filename);

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'Content-Length': String(buffer.byteLength),
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    console.error('[avatars] Error serving avatar:', error);
    return NextResponse.json({ error: 'Error al servir el avatar' }, { status: 500 });
  }
}
