/**
 * Avatar generation flow for teams.
 * Uses gemini-3.1-flash-image-preview to generate a heraldic shield
 * that follows the Clue Arena dark-mystery game aesthetic.
 *
 * Server-side only — never import in client components.
 */
import path from 'path';
import fs from 'fs/promises';
import { ai } from '@/lib/ai/genkit';

const IMAGE_MODEL = 'googleai/gemini-3.1-flash-image-preview';
const AVATARS_DIR = path.join(process.cwd(), 'public', 'avatars');

/**
 * Generates a heraldic shield avatar based on team name and description.
 * Saves the PNG to `public/avatars/<teamId>.png` and returns the public URL.
 */
export async function generateTeamAvatar(
  teamId: string,
  nombre: string,
  descripcion?: string | null
): Promise<string> {
  const prompt = buildPrompt(nombre, descripcion);

  const { media } = await ai.generate({
    model: IMAGE_MODEL,
    prompt,
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  if (!media?.url) {
    throw new Error('El modelo no devolvió ninguna imagen');
  }

  // media.url is a data:image/png;base64,... URL
  const publicUrl = await saveDataUrl(teamId, media.url);
  return publicUrl;
}

/** Persists an externally-supplied data URL (from upload) and returns the public URL. */
export async function saveAvatarDataUrl(teamId: string, dataUrl: string): Promise<string> {
  return saveDataUrl(teamId, dataUrl);
}

// ---------------------------------------------------------------------------

function buildPrompt(nombre: string, descripcion?: string | null): string {
  const descPart = descripcion
    ? `The team's motto or description: "${descripcion}".`
    : '';

  return (
    `Design an avatar/logo for a detective team named "${nombre}". ` +
    descPart +
    'No detailed to be shown in small area.' +
    `Return only the image, no text.`
  );
}

async function saveDataUrl(teamId: string, dataUrl: string): Promise<string> {
  // Determine extension from MIME type
  const mimeMatch = dataUrl.match(/^data:(image\/\w+);base64,/);
  const mime = mimeMatch?.[1] ?? 'image/png';
  const ext = mime.split('/')[1] ?? 'png';

  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  await fs.mkdir(AVATARS_DIR, { recursive: true });
  const filename = `${teamId}.${ext}`;
  await fs.writeFile(path.join(AVATARS_DIR, filename), buffer);

  return `/avatars/${filename}`;
}
