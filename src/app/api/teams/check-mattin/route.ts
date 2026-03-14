import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/session';

const CheckMattinSchema = z.object({
  agentId: z.string().min(1, 'El agent_id es requerido'),
  appId: z.string().min(1, 'El app_id es requerido'),
  mattinApiKey: z.string().min(1, 'La API key es requerida'),
});

interface MattinHeloResponse {
  response?: string;
  conversation_id?: string;
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CheckMattinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  if (!process.env.MATTIN_API_URL) {
    return NextResponse.json(
      { error: 'MATTIN_API_URL no está configurado en el servidor' },
      { status: 500 }
    );
  }

  const mattinUrl = `${process.env.MATTIN_API_URL}/public/v1/app/${encodeURIComponent(parsed.data.appId)}/chat/${encodeURIComponent(parsed.data.agentId)}/call`;
  const formData = new FormData();
  formData.append('message', 'helo');

  try {
    const response = await fetch(mattinUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': parsed.data.mattinApiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        {
          reachable: false,
          error: detail || `MattinAI API error: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const payload = (await response.json()) as MattinHeloResponse;

    return NextResponse.json({
      reachable: true,
      response: payload.response ?? '',
      conversationId: payload.conversation_id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { reachable: false, error: message },
      { status: 502 }
    );
  }
}
