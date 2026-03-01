import { InstructionsLayout } from '@/components/instructions/InstructionsLayout';
import { SectionWrapper } from '@/components/instructions/SectionWrapper';
import { CodeBlock } from '@/components/instructions/CodeBlock';
import { SuspectsTable, WeaponsTable, ScenariosTable } from '@/components/instructions/ElementsTable';
import { ScoringTable } from '@/components/instructions/ScoringTable';
import { getTranslations } from 'next-intl/server';

// ── Code snippets ──────────────────────────────────────────────────────────────

const AGENT_RESPONSE_SCHEMA = `type AgentResponse =
  | { action: "suggestion"; sospechoso: string; arma: string; escenario: string }
  | { action: "accusation"; sospechoso: string; arma: string; escenario: string }
  | { action: "pass" }
  | { action: "show_card"; carta: string }
  | { action: "cannot_refute" };`;

const EXAMPLE_SUGGESTION = `{
  "action": "suggestion",
  "sospechoso": "Coronel Mustard",
  "arma": "Teclado mecánico",
  "escenario": "El Laboratorio"
}`;

const EXAMPLE_ACCUSATION = `{
  "action": "accusation",
  "sospechoso": "Dra. Peacock",
  "arma": "Cable de red",
  "escenario": "La Sala de Servidores"
}`;

const EXAMPLE_PASS = `{ "action": "pass" }`;

const EXAMPLE_SHOW_CARD = `{
  "action": "show_card",
  "carta": "Coronel Mustard"
}`;

const EXAMPLE_CANNOT_REFUTE = `{ "action": "cannot_refute" }`;

const GAME_STATE_INPUT = `{
  "game_id": "string",   // ID de la partida en curso
  "team_id": "string"    // ID del equipo (coincide con el issuer del token)
}`;

const GAME_STATE_OUTPUT = `{
  "gameId": "string",
  "estado": "en_curso | finalizada | pendiente",
  "turnoActual": 3,
  "esElTurnoDeEquipo": true,
  "equipos": [
    {
      "equipoId": "string",
      "orden": 0,
      "esPropio": true,
      "eliminado": false,
      "numCartas": 4,
      "cartas": ["Directora Scarlett", "El Laboratorio", "Teclado mecánico", "Dra. Peacock"]
    },
    {
      "equipoId": "string",
      "orden": 1,
      "esPropio": false,
      "eliminado": false,
      "numCartas": 3,
      "cartas": []
    }
  ],
  "historial": [
    {
      "turno": 1,
      "equipoId": "string",
      "tipo": "suggestion",
      "sospechoso": "Coronel Mustard",
      "arma": "Teclado mecánico",
      "escenario": "El Laboratorio",
      "refutadoPor": "string | null",
      "cartaMostrada": "Coronel Mustard | null",
      "nadiePudoRefutar": false
    }
  ]
}`;

const MEMORY_INPUT = `{
  "game_id": "string",
  "team_id": "string"
}`;

const MEMORY_OUTPUT = `{
  "memory": { }   // objeto JSON arbitrario; vacío {} en el primer turno
}`;

const SAVE_MEMORY_INPUT = `{
  "game_id": "string",
  "team_id": "string",
  "memory": {
    "cartasDescartadas": ["Directora Scarlett", "El Laboratorio"],
    "hipotesisSobre": { "sospechoso": "Coronel Mustard", "confianza": 0.8 }
  }
}`;

const SAVE_MEMORY_OUTPUT = `{ "ok": true }`;

const SEQUENCE_DIAGRAM = `Motor de juego
     │
     │  POST /api/mcp  →  get_game_state({ game_id, team_id })
     ├─────────────────────────────────────────────────────► Agente
     │◄─────────────────────────────────────────────────────
     │                              GameStateView filtrada
     │
     │  POST /api/mcp  →  get_agent_memory({ game_id, team_id })
     ├─────────────────────────────────────────────────────► Agente
     │◄─────────────────────────────────────────────────────
     │                              { memory: { ... } }
     │
     │           (el agente razona y elige una acción)
     │
     │  POST /api/mcp  →  save_agent_memory({ ... })  [opcional]
     ├─────────────────────────────────────────────────────► Agente
     │◄─────────────────────────────────────────────────────
     │
     │  AgentResponse { action: "suggestion", ... }
     │◄─────────────────────────────────────────────────────
     │
     │  El motor valida y aplica la acción → estado actualizado`;

const PYTHON_TEMPLATE = `# agent.py — Agente mínimo Clue Arena (Python)
# Requiere: pip install mcp

import json
import os
import asyncio
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ARENA_MCP_URL = os.environ["ARENA_MCP_URL"]   # https://<dominio>/api/mcp
TEAM_TOKEN    = os.environ["TEAM_MCP_TOKEN"]  # Token distribuido por la organización


async def play_turn(game_id: str, team_id: str) -> dict:
    """Decide la acción para el turno actual del equipo."""
    async with streamablehttp_client(
        ARENA_MCP_URL,
        headers={"Authorization": f"Bearer {TEAM_TOKEN}"},
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1. Leer estado de partida
            gs_result = await session.call_tool(
                "get_game_state", {"game_id": game_id, "team_id": team_id}
            )
            game_state = json.loads(gs_result.content[0].text)

            # 2. Leer memoria del agente
            mem_result = await session.call_tool(
                "get_agent_memory", {"game_id": game_id, "team_id": team_id}
            )
            memory = json.loads(mem_result.content[0].text).get("memory", {})

            # 3. Decidir acción — IMPLEMENTA AQUÍ TU LÓGICA
            action = {
                "action": "suggestion",
                "sospechoso": "Coronel Mustard",
                "arma": "Teclado mecánico",
                "escenario": "El Laboratorio",
            }

            # 4. Persistir deducciones
            memory["ultimaAccion"] = action
            await session.call_tool(
                "save_agent_memory",
                {"game_id": game_id, "team_id": team_id, "memory": memory},
            )

            return action


async def refute(game_id: str, team_id: str, sugerencia: dict) -> dict:
    """Decide qué carta mostrar para refutar, o indica que no puede."""
    async with streamablehttp_client(
        ARENA_MCP_URL,
        headers={"Authorization": f"Bearer {TEAM_TOKEN}"},
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            gs_result = await session.call_tool(
                "get_game_state", {"game_id": game_id, "team_id": team_id}
            )
            game_state = json.loads(gs_result.content[0].text)

            # Obtener propias cartas
            propias = next(
                (e["cartas"] for e in game_state["equipos"] if e["esPropio"]), []
            )
            cartas_sugerencia = [
                sugerencia["sospechoso"],
                sugerencia["arma"],
                sugerencia["escenario"],
            ]

            # Buscar coincidencia exacta (capitalización incluida)
            puede_refutar = [c for c in propias if c in cartas_sugerencia]

            if puede_refutar:
                return {"action": "show_card", "carta": puede_refutar[0]}
            return {"action": "cannot_refute"}`;

const TYPESCRIPT_TEMPLATE = `// agent.ts — Agente mínimo Clue Arena (TypeScript)
// Requiere: npm install @modelcontextprotocol/sdk

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ARENA_MCP_URL = process.env.ARENA_MCP_URL!;
const TEAM_TOKEN    = process.env.TEAM_MCP_TOKEN!;

function makeClient() {
  return new Client(
    { name: "clue-arena-agent", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

async function callTool<T>(client: Client, name: string, args: object): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  return JSON.parse((result.content[0] as { text: string }).text) as T;
}

export async function playTurn(gameId: string, teamId: string): Promise<object> {
  const transport = new StreamableHTTPClientTransport(new URL(ARENA_MCP_URL), {
    requestInit: { headers: { Authorization: \`Bearer \${TEAM_TOKEN}\` } },
  });
  const client = makeClient();
  await client.connect(transport);

  // 1. Estado de partida
  const gameState = await callTool<{ equipos: Array<{ esPropio: boolean; cartas: string[] }> }>(
    client, "get_game_state", { game_id: gameId, team_id: teamId }
  );

  // 2. Memoria del agente
  const { memory = {} } = await callTool<{ memory: Record<string, unknown> }>(
    client, "get_agent_memory", { game_id: gameId, team_id: teamId }
  );

  // 3. Decidir acción — IMPLEMENTA AQUÍ TU LÓGICA
  const action = {
    action: "suggestion" as const,
    sospechoso: "Coronel Mustard",
    arma: "Teclado mecánico",
    escenario: "El Laboratorio",
  };

  // 4. Guardar memoria
  await callTool(client, "save_agent_memory", {
    game_id: gameId,
    team_id: teamId,
    memory: { ...memory, ultimaAccion: action },
  });

  await client.close();
  return action;
}`;

const FAQ_ROWS = [
  {
    error: 'EVT_INVALID_FORMAT en todos los turnos',
    cause: 'La respuesta no es JSON plano o falta el campo action',
    solution: 'Devolver exactamente el objeto AgentResponse sin envolturas extra',
  },
  {
    error: 'EVT_INVALID_CARD en la primera sugerencia',
    cause: 'Nombre con mayúscula, tilde o espacio distinto al canónico',
    solution: 'Comparar con la tabla de §6 y copiar literalmente los nombres',
  },
  {
    error: 'historial: [] siempre vacío',
    cause: 'Bug conocido del motor (OPENQ pendiente RFC G003)',
    solution: 'Tratar el historial como posiblemente vacío en versiones previas al evento',
  },
  {
    error: '401 Unauthorized',
    cause: 'TEAM_MCP_TOKEN incorrecto o con espacios adicionales',
    solution: 'Verificar que se envía como Bearer <token> sin espacios extra',
  },
  {
    error: 'cannot_refute cuando el agente sí tiene carta',
    cause: 'Comparación de nombres no exacta (case-sensitive)',
    solution: 'Usar comparación === estricta; los nombres de cartas son idénticos a la tabla §6',
  },
  {
    error: 'EVT_TIMEOUT frecuente',
    cause: 'El LLM supera el tiempo límite del turno',
    solution: 'Reducir el tamaño del prompt o usar un modelo más rápido',
  },
  {
    error: 'EVT_REDUNDANT_SUGGESTION repetido',
    cause: 'Se repite la misma tripla (sospechoso + arma + escenario)',
    solution: 'Guardar sugerencias previas en save_agent_memory y excluirlas al decidir',
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function InstruccionesPage() {
  const t = await getTranslations('instrucciones');
  const tJuego = await getTranslations('juego');
  return (
    <InstructionsLayout>
      {/* §1 Hero / Introducción */}
      <section
        id="intro"
        className="scroll-mt-20 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-8 md:p-12"
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-500">
          {t('eventoLabel')}
        </div>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          {tJuego('subtitulo')}
        </h1>
        <p className="mb-6 text-lg text-slate-400 max-w-2xl">
          {t('heroBannerDesc').split('Clue Arena').map((part, i, arr) =>
            i < arr.length - 1
              ? <span key={i}>{part}<strong className="text-slate-200"> Clue Arena</strong></span>
              : <span key={i}>{part}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            { label: t('protocolo'), value: 'MCP (HTTP + JSON-RPC)' },
            { label: t('lenguajes'), value: 'Python · TypeScript · cualquiera' },
            { label: t('auth'), value: 'Bearer token por equipo' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-md border border-slate-700 bg-slate-800/50 px-4 py-2"
            >
              <span className="text-slate-500">{label}: </span>
              <span className="text-slate-200 font-medium">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* §2 Cómo funciona un agente */}
      <SectionWrapper id="como-funciona" title={t('sec2Titulo')} titleNumber="2">
        <p>
          El motor de juego invoca al agente de tu equipo en dos situaciones durante la partida:
        </p>

        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">Situación</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">Modo</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">Qué debe devolver</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">Es el turno del equipo</td>
                <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-cyan-300 whitespace-nowrap">play_turn</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">Una sugerencia, acusación o pase</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">El equipo puede refutar la sugerencia de otro</td>
                <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-cyan-300 whitespace-nowrap">refute</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">Carta a mostrar, o indicar que no puede refutar</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm text-slate-400 mt-2">
          <strong className="text-amber-400">Importante:</strong> el agente{' '}
          <strong>no hace llamadas directas para aplicar acciones</strong>. La acción se expresa en
          el objeto <code className="font-mono bg-slate-800 px-1 rounded text-cyan-300">AgentResponse</code>{' '}
          devuelto al motor, que la valida y aplica.
        </p>

        <h3 className="mt-6 mb-3 font-semibold text-slate-200">
          Diagrama de secuencia — modo <code className="font-mono text-cyan-300">play_turn</code>
        </h3>
        <CodeBlock code={SEQUENCE_DIAGRAM} language="text" />
      </SectionWrapper>

      {/* §3 Contrato MCP */}
      <SectionWrapper id="contrato-mcp" title={t('sec3Titulo')} titleNumber="3">
        <h3 className="font-semibold text-slate-200 mb-2">Endpoint</h3>
        <CodeBlock
          language="http"
          code={`POST https://<dominio-del-evento>/api/mcp\nContent-Type: application/json\nAuthorization: Bearer <TEAM_MCP_TOKEN>`}
        />

        <p className="mt-4">
          El servidor sigue el protocolo{' '}
          <strong className="text-slate-200">Model Context Protocol</strong> en su variante{' '}
          <strong className="text-slate-200">HTTP + JSON-RPC</strong>. Usa el SDK oficial en lugar
          de implementar el protocolo a mano.
        </p>

        <h3 className="mt-6 font-semibold text-slate-200 mb-3">SDK oficial recomendado</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-left">Lenguaje</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-left">Paquete</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-left">Versión mínima</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">Python</td>
                <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-cyan-300">mcp</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-400">1.x (PyPI)</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">TypeScript / JavaScript</td>
                <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-cyan-300">@modelcontextprotocol/sdk</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-slate-400">1.x (npm)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-md border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          <strong>Seguridad:</strong> el <code className="font-mono">TEAM_MCP_TOKEN</code> es único
          por equipo. No lo incluyas en código público. Usa variables de entorno y repositorio
          privado.
        </div>
      </SectionWrapper>

      {/* §4 Herramientas disponibles */}
      <SectionWrapper id="herramientas" title={t('sec4Titulo')} titleNumber="4">
        <p>
          Las tres herramientas disponibles son de <strong>solo consulta</strong> (lectura de estado
          y memoria). Las acciones de juego se expresan exclusivamente en la respuesta devuelta al
          motor.
        </p>

        {/* get_game_state */}
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/50">
          <div className="border-b border-slate-700 px-4 py-3">
            <h3 className="font-mono font-bold text-cyan-400 text-base">get_game_state</h3>
            <p className="mt-1 text-sm text-slate-400">
              Devuelve el estado de la partida filtrado para tu equipo. Solo ves tus propias cartas
              y el historial de sugerencias público.
            </p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Parámetros de entrada
              </p>
              <CodeBlock code={GAME_STATE_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Respuesta (GameStateView)
              </p>
              <CodeBlock code={GAME_STATE_OUTPUT} language="json" />
            </div>
          </div>
          <div className="border-t border-slate-700 px-4 py-3 text-xs text-slate-500">
            <strong className="text-slate-400">cartaMostrada:</strong> solo relleno en el historial
            propio cuando el equipo fue el sugeridor. El refutador ya sabe qué carta mostró. Los
            demás nunca lo ven.
          </div>
        </div>

        {/* get_agent_memory */}
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50">
          <div className="border-b border-slate-700 px-4 py-3">
            <h3 className="font-mono font-bold text-cyan-400 text-base">get_agent_memory</h3>
            <p className="mt-1 text-sm text-slate-400">
              Recupera la memoria persistida entre invocaciones: cartas descartadas, hipótesis,
              anotaciones de la libreta del detective.
            </p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Entrada</p>
              <CodeBlock code={MEMORY_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Respuesta</p>
              <CodeBlock code={MEMORY_OUTPUT} language="json" />
            </div>
          </div>
        </div>

        {/* save_agent_memory */}
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50">
          <div className="border-b border-slate-700 px-4 py-3">
            <h3 className="font-mono font-bold text-cyan-400 text-base">save_agent_memory</h3>
            <p className="mt-1 text-sm text-slate-400">
              Persiste la memoria del agente. Llamar al final del razonamiento para guardar las
              deducciones del turno.{' '}
              <strong className="text-slate-300">Límite: 64 KB por equipo por partida.</strong>
            </p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Entrada</p>
              <CodeBlock code={SAVE_MEMORY_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Respuesta</p>
              <CodeBlock code={SAVE_MEMORY_OUTPUT} language="json" />
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* §5 Estructura de la respuesta del agente */}
      <SectionWrapper id="respuesta" title={t('sec5Titulo')} titleNumber="5">
        <p>
          El motor espera un objeto{' '}
          <code className="font-mono bg-slate-800 px-1 rounded text-cyan-300">AgentResponse</code>{' '}
          con la siguiente estructura TypeScript:
        </p>
        <CodeBlock code={AGENT_RESPONSE_SCHEMA} language="typescript" />

        <h3 className="mt-6 mb-3 font-semibold text-slate-200">
          Acciones válidas por modo
        </h3>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-left">Modo</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-left">Acciones válidas</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-left">
                  Inválidas → <code className="font-mono text-xs text-red-400">EVT_INVALID_FORMAT</code>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-cyan-300">play_turn</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-emerald-400 font-mono text-xs">suggestion · accusation · pass</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-red-400 font-mono text-xs">show_card · cannot_refute</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-cyan-300">refute</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-emerald-400 font-mono text-xs">show_card · cannot_refute</td>
                <td className="px-4 py-2.5 border-b border-slate-800 text-red-400 font-mono text-xs">suggestion · accusation · pass</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 mb-3 font-semibold text-slate-200">Ejemplos</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Sugerencia', code: EXAMPLE_SUGGESTION },
            { label: 'Acusación', code: EXAMPLE_ACCUSATION },
            { label: 'Pase (−5 pts)', code: EXAMPLE_PASS },
            { label: 'Mostrar carta', code: EXAMPLE_SHOW_CARD },
            { label: 'No puede refutar', code: EXAMPLE_CANNOT_REFUTE },
          ].map(({ label, code }) => (
            <div key={label}>
              <p className="mb-1.5 text-xs font-semibold text-slate-400">{label}</p>
              <CodeBlock code={code} language="json" />
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          La carta en <code className="font-mono">show_card</code> debe ser{' '}
          <strong>una de tus cartas propias</strong> que aparezca en la sugerencia. Si se envía una
          carta que no pertenece al equipo, el motor aplica{' '}
          <code className="font-mono text-red-400">EVT_INVALID_FORMAT</code>.
        </div>
      </SectionWrapper>

      {/* §6 Elementos del juego */}
      <SectionWrapper id="elementos" title={t('sec6Titulo')} titleNumber="6">
        <p>
          Los valores de <code className="font-mono bg-slate-800 px-1 rounded text-cyan-300">sospechoso</code>,{' '}
          <code className="font-mono bg-slate-800 px-1 rounded text-cyan-300">arma</code> y{' '}
          <code className="font-mono bg-slate-800 px-1 rounded text-cyan-300">escenario</code> en
          las respuestas del agente deben coincidir{' '}
          <strong className="text-white">exactamente</strong> con los nombres canónicos del evento
          (mayúsculas, tildes y espacios incluidos). Un nombre incorrecto genera{' '}
          <code className="font-mono text-red-400">EVT_INVALID_CARD</code> (−30 pts).
        </p>

        <h3 className="mt-6 mb-3 font-semibold text-slate-200">Sospechosos (6)</h3>
        <SuspectsTable />

        <h3 className="mt-6 mb-3 font-semibold text-slate-200">Armas (6)</h3>
        <WeaponsTable />

        <h3 className="mt-6 mb-3 font-semibold text-slate-200">Escenarios (9)</h3>
        <ScenariosTable />
      </SectionWrapper>

      {/* §7 Sistema de puntuación */}
      <SectionWrapper id="puntuacion" title={t('sec7Titulo')} titleNumber="7">
        <ScoringTable />

        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            Bonificación por eficiencia{' '}
            <code className="font-mono text-xs text-cyan-300">EVT_WIN_EFFICIENCY</code>
          </h3>
          <p className="text-sm text-slate-400 mb-3">
            Solo se otorga al equipo ganador, junto con{' '}
            <code className="font-mono text-xs text-emerald-400">EVT_WIN</code>. Premia resolver el
            caso en pocos turnos propios:
          </p>
          <CodeBlock
            language="text"
            code={`EVT_WIN_EFFICIENCY = max(0, 500 − (T − T_min) × 25)\n\ndonde:\n  T      = turnos propios jugados hasta la acusación correcta (inclusive)\n  T_min  = 2  (mínimo teórico: 1 sugerencia + 1 acusación)\n  umbral = 22 turnos propios → bonificación = 0`}
          />
        </div>

        <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
          <strong className="text-slate-200">Implicaciones para el diseño del agente:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>No acusar hasta tener certeza: −150 pts y eliminación de la partida.</li>
            <li>Variar sugerencias: repetir la misma tripla cuesta −20 pts.</li>
            <li>Responder siempre en JSON válido: error de formato → −25 pts y turno consumido.</li>
            <li>Refutar cuando sea posible: aporta +15 pts adicionales.</li>
            <li>Evitar pases innecesarios: cada pase cuesta −5 pts.</li>
          </ul>
        </div>
      </SectionWrapper>

      {/* §8 Inicio rápido */}
      <SectionWrapper id="quickstart" title={t('sec8Titulo')} titleNumber="8">
        <p>
          Las plantillas implementan el{' '}
          <strong>agente mínimo funcional</strong>: siempre propone la misma sugerencia como
          ejemplo. El valor diferencial viene de la lógica de razonamiento que cada equipo
          implementa en el paso 3.
        </p>

        <div className="mt-6">
          <h3 className="mb-3 font-semibold text-slate-200">
            Plantilla Python (SDK MCP oficial)
          </h3>
          <p className="mb-3 text-sm text-slate-400">
            Instalación:{' '}
            <code className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300">
              pip install mcp
            </code>
          </p>
          <CodeBlock code={PYTHON_TEMPLATE} language="python" filename="agent.py" />
        </div>

        <div className="mt-8">
          <h3 className="mb-3 font-semibold text-slate-200">
            Plantilla TypeScript (SDK MCP oficial)
          </h3>
          <p className="mb-3 text-sm text-slate-400">
            Instalación:{' '}
            <code className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300">
              npm install @modelcontextprotocol/sdk
            </code>
          </p>
          <CodeBlock code={TYPESCRIPT_TEMPLATE} language="typescript" filename="agent.ts" />
        </div>

        <div className="mt-6 rounded-md border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
          <strong className="text-slate-200">Variables de entorno requeridas:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside font-mono text-xs">
            <li>
              <span className="text-cyan-300">ARENA_MCP_URL</span> — URL del endpoint MCP de la
              plataforma (comunicada por la organización)
            </li>
            <li>
              <span className="text-cyan-300">TEAM_MCP_TOKEN</span> — Token Bearer del equipo
              (comunicado por la organización)
            </li>
          </ul>
        </div>
      </SectionWrapper>

      {/* §9 Registro del agente */}
      <SectionWrapper id="registro" title={t('sec9Titulo')} titleNumber="9">
        <p>
          Una vez desplegado el agente en un servidor accesible, regístralo en la plataforma para
          que participe en las partidas:
        </p>
        <ol className="mt-4 space-y-2 list-decimal list-inside text-slate-300">
          <li>Accede a la plataforma con las credenciales corporativas de tu equipo.</li>
          <li>
            Navega a <strong className="text-slate-200">Mi Equipo</strong> → sección{' '}
            <strong className="text-slate-200">Agente</strong>.
          </li>
          <li>
            Introduce la URL del endpoint MCP de tu agente (debe responder a peticiones{' '}
            <code className="font-mono text-xs bg-slate-800 px-1 rounded">POST</code> con
            JSON-RPC).
          </li>
          <li>
            Pulsa <strong className="text-slate-200">Guardar y verificar conexión</strong> — la
            plataforma realizará un health-check y mostrará el resultado.
          </li>
        </ol>
        <div className="mt-4 rounded-md border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          El endpoint del agente debe ser accesible desde los servidores de la plataforma. Los
          agentes locales (<code className="font-mono">localhost</code>) no son válidos para el
          evento.
        </div>
      </SectionWrapper>

      {/* §10 FAQ y errores comunes */}
      <SectionWrapper id="faq" title={t('sec10Titulo')} titleNumber="10">
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Tabla de errores frecuentes y soluciones</caption>
            <thead>
              <tr>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">Error / Situación</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">Causa probable</th>
                <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">Solución</th>
              </tr>
            </thead>
            <tbody>
              {FAQ_ROWS.map((row) => (
                <tr key={row.error} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 border-b border-slate-800 text-amber-400 align-top whitespace-nowrap">
                    {row.error}
                  </td>
                  <td className="px-4 py-3 border-b border-slate-800 text-slate-400 align-top">
                    {row.cause}
                  </td>
                  <td className="px-4 py-3 border-b border-slate-800 text-slate-300 align-top">
                    {row.solution}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-md border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
          ¿Tienes dudas no resueltas aquí? Contacta con la organización en el canal oficial del
          evento.
        </div>
      </SectionWrapper>
    </InstructionsLayout>
  );
}
