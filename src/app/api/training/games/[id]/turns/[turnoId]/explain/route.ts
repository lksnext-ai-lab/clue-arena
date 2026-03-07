/**
 * POST /api/training/games/[id]/turns/[turnoId]/explain
 *
 * AI-powered turn explainer for training replay (F015).
 * Analyses all available data for a turn (GameStateView, AgentInteractionTrace,
 * action, memory diff) and returns a structured coaching explanation via Genkit.
 *
 * Accessible by the owning equipo or an admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { partidasEntrenamiento, turnosEntrenamiento } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ai, DEFAULT_MODEL } from '@/lib/ai/genkit';
import type {
  AgentInteractionTrace,
  AgentResponse,
} from '@/types/api';

// ─── Prompt helpers ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente experto en Cluedo y en análisis de agentes de inteligencia artificial.
Tu rol es analizar turnos de partidas de entrenamiento y proporcionar explicaciones claras, técnicas y orientadas a la mejora del agente.

CONTEXTO DEL JUEGO CLUEDO:
- Sospechosos: Scarlett, Mostaza, Ciruela, Verde, Pavo, Blanco
- Armas: Candelabro, Cuchillo, Tubo de plomo, Revólver, Cuerda, Llave inglesa
- Habitaciones: Cocina, Sala de baile, Conservatorio, Billar, Biblioteca, Estudio, Vestíbulo, Sala, Comedor
- Los agentes pueden hacer: suggestion (sugerencia), accusation (acusación), pass (pase), show_card (mostrar carta), cannot_refute (no puede refutar)
- Objetivo: acusar correctamente el sospechoso, arma y habitación que están en el sobre secreto
- En entrenamiento: el agente real usa protocolo MCP; los bots usan Genkit local

ESTRUCTURA DE TU RESPUESTA (en español, orientada al equipo):
1. **Situación del turno**: qué estaba pasando en el juego y qué información tenía el agente
2. **Decisión tomada**: qué hizo el agente y el razonamiento inferido
3. **Evaluación estratégica**: ¿fue una buena decisión? ¿por qué sí o no?
4. **Puntos de mejora**: qué podría hacer mejor el agente en una situación similar
5. **Observaciones técnicas** (solo si aplica): errores de parsing, latencia llamativas, tool calls ineficientes, cambios de memoria relevantes

Sé directo, técnico y útil. Máximo 350 palabras.`;

/** Truncate a string to a max length with ellipsis. */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '…[truncado]';
}

function buildUserMessage(data: {
  numero: number;
  esBot: boolean;
  equipoId: string;
  durationMs: number | null;
  accion: AgentResponse | null;
  gameStateView: Record<string, unknown> | null;
  agentTrace: AgentInteractionTrace | null;
  memoriaInicial: Record<string, unknown> | null;
  memoriaFinal: Record<string, unknown> | null;
}): string {
  const parts: string[] = [];

  parts.push(`## Turno ${data.numero} — ${data.esBot ? `Bot (${data.equipoId})` : 'Agente real del equipo'}`);
  if (data.durationMs != null) {
    parts.push(`Duración total: ${data.durationMs} ms`);
  }

  // Action
  const action = data.accion?.action;
  if (action) {
    parts.push(`\n### Acción tomada\n\`\`\`json\n${JSON.stringify(action, null, 2)}\n\`\`\``);
  } else {
    parts.push('\n### Acción tomada\nNo se registró ninguna acción.');
  }

  // Reasoning (if bot or from parsed accion)
  if (data.accion?.reasoning && data.accion.reasoning !== 'parse_error') {
    parts.push(`\n### Razonamiento del agente\n${truncate(data.accion.reasoning, 800)}`);
  }

  // GameStateView (key fields only to avoid token explosion)
  if (data.gameStateView) {
    const gsv = data.gameStateView as Record<string, unknown>;
    const summary = {
      turnoActual: gsv['turnoActual'],
      misManos: gsv['misManos'],
      jugadores: Array.isArray(gsv['jugadores'])
        ? (gsv['jugadores'] as unknown[]).map((j) => {
            const jj = j as Record<string, unknown>;
            return { id: jj['id'], esBot: jj['esBot'], eliminado: jj['eliminado'] };
          })
        : gsv['jugadores'],
      historialReciente: Array.isArray(gsv['historial'])
        ? (gsv['historial'] as unknown[]).slice(-5)
        : gsv['historial'],
      mapaDeduccionResumen: gsv['mapaDeduccion'], // could be large but include it
    };
    parts.push(
      `\n### GameStateView (resumen)\n\`\`\`json\n${truncate(JSON.stringify(summary, null, 2), 2000)}\n\`\`\``,
    );
  }

  // Agent trace (real team turns only)
  if (data.agentTrace && !data.esBot) {
    const trace = data.agentTrace;
    parts.push(`\n### Traza del agente`);
    parts.push(`- Tipo de invocación: ${trace.type}`);
    parts.push(`- Iteraciones LLM: ${trace.exchanges.length}`);
    parts.push(`- Total tool calls: ${trace.totalToolCalls}`);

    if (trace.parseError) {
      parts.push(`- ⚠️ Error de parsing: ${trace.parseError}`);
    }

    // Include up to 2 LLM exchanges
    const exchanges = trace.exchanges.slice(0, 2);
    exchanges.forEach((ex, i) => {
      parts.push(`\n#### Iteración LLM ${i + 1} (${ex.durationMs} ms)`);
      parts.push(`System prompt: ${truncate(ex.systemPrompt, 600)}`);
      parts.push(`Mensaje usuario: ${truncate(ex.userPrompt, 600)}`);
      if (ex.toolCalls.length > 0) {
        parts.push(`Tool calls (${ex.toolCalls.length}):`);
        ex.toolCalls.slice(0, 4).forEach((tc) => {
          parts.push(`  - ${tc.tool} (${tc.durationMs} ms): args=${truncate(JSON.stringify(tc.args), 200)}`);
        });
      }
      parts.push(`Respuesta LLM: ${truncate(ex.rawResponse, 800)}`);
    });
    if (trace.exchanges.length > 2) {
      parts.push(`_(+ ${trace.exchanges.length - 2} iteraciones adicionales omitidas)_`);
    }
  }

  // Memory diff
  if (data.memoriaInicial != null || data.memoriaFinal != null) {
    parts.push('\n### Memoria del agente');
    if (data.memoriaInicial != null) {
      parts.push(`Antes: ${truncate(JSON.stringify(data.memoriaInicial), 500)}`);
    }
    if (data.memoriaFinal != null) {
      parts.push(`Después: ${truncate(JSON.stringify(data.memoriaFinal), 500)}`);
    }
  }

  return parts.join('\n');
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; turnoId: string }> },
) {
  const { id, turnoId } = await params;

  const session = await getAuthSession();
  if (!session?.user || (session.user.rol !== 'equipo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Fetch game
  const game = await db
    .select({ equipoId: partidasEntrenamiento.equipoId })
    .from(partidasEntrenamiento)
    .where(eq(partidasEntrenamiento.id, id))
    .get();

  if (!game) {
    return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
  }

  // RBAC: equipo can only explain turns from their own games
  if (session.user.rol === 'equipo' && session.user.equipo?.id !== game.equipoId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Fetch turn
  const turn = await db
    .select()
    .from(turnosEntrenamiento)
    .where(eq(turnosEntrenamiento.id, turnoId))
    .get();

  if (!turn || turn.partidaId !== id) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  // Parse stored JSON fields (all stored as text JSON in SQLite)
  const accion = turn.accion ? (JSON.parse(turn.accion) as AgentResponse) : null;
  const gameStateView = turn.gameStateView
    ? (JSON.parse(turn.gameStateView) as Record<string, unknown>)
    : null;
  const agentTrace = turn.agentTrace
    ? (JSON.parse(turn.agentTrace) as AgentInteractionTrace)
    : null;
  const memoriaInicial = turn.memoriaInicial
    ? (JSON.parse(turn.memoriaInicial) as Record<string, unknown>)
    : null;
  const memoriaFinal = turn.memoriaFinal
    ? (JSON.parse(turn.memoriaFinal) as Record<string, unknown>)
    : null;

  // Build user message with all turn context
  const userMessage = buildUserMessage({
    numero: turn.numero,
    esBot: turn.esBot,
    equipoId: turn.equipoId,
    durationMs: turn.durationMs,
    accion,
    gameStateView,
    agentTrace,
    memoriaInicial,
    memoriaFinal,
  });

  // Generate explanation via Genkit
  const response = await ai.generate({
    model: DEFAULT_MODEL,
    system: SYSTEM_PROMPT,
    prompt: userMessage,
  });

  return NextResponse.json({
    turnoId: turn.id,
    numero: turn.numero,
    explanation: response.text,
  });
}
