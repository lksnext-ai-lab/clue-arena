import type { ReactNode } from 'react';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  DatabaseZap,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { InstructionsLayout } from '@/components/instructions/InstructionsLayout';
import { SectionWrapper } from '@/components/instructions/SectionWrapper';
import { CodeBlock } from '@/components/instructions/CodeBlock';
import { SuspectsTable, WeaponsTable, ScenariosTable } from '@/components/instructions/ElementsTable';
import { MermaidDiagram } from '@/components/instructions/MermaidDiagram';
import { ScoringTable } from '@/components/instructions/ScoringTable';
import { getTranslations } from 'next-intl/server';

const AGENT_RESPONSE_SCHEMA = `type AgentResponse =
  | { action: "suggestion"; sospechoso: string; arma: string; escenario: string; spectatorComment?: string }
  | { action: "accusation"; sospechoso: string; arma: string; escenario: string; spectatorComment?: string }
  | { action: "pass";                                                            spectatorComment?: string }
  | { action: "show_card"; carta: string;                                        spectatorComment?: string }
  | { action: "cannot_refute";                                                   spectatorComment?: string };

// spectatorComment: opcional, max. 160 caracteres, sin saltos de linea.
// Se muestra en la Arena a los espectadores durante la partida.`;

const EXAMPLE_SUGGESTION = `{
  "action": "suggestion",
  "sospechoso": "Coronel Mustard",
  "arma": "Teclado mecánico",
  "escenario": "El Laboratorio",
  "spectatorComment": "Sé que Mustard estuvo en el laboratorio..."
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
  "carta": "Coronel Mustard",
  "spectatorComment": "Tengo esta carta, no puede ser él."
}`;

const EXAMPLE_CANNOT_REFUTE = `{ "action": "cannot_refute" }`;

const GAME_STATE_INPUT = `{
  "game_id": "string",
  "team_id": "string"
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
  "memory": { }
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

const SYSTEM_PROMPT = `Eres un agente detective de IA que participa en una competición de Cluedo corporativo
llamada "El Algoritmo Asesinado".

## Tools MCP disponibles

Tienes acceso a tres herramientas MCP. Úsalas en este orden en cada turno:

1. get_game_state(game_id, team_id)
   Devuelve el estado actual de la partida filtrado para tu equipo (GameStateView).
   Incluye: tus cartas en mano, el turno actual, el historial de sugerencias/refutaciones,
   el estado de cada equipo y los valores canónicos válidos del juego. Consulta siempre este campo.

2. get_agent_memory(game_id, team_id)
   Recupera el JSON de deducción que guardaste en turnos anteriores.
   Devuelve: { memory: { ... }, updatedAt: "ISO string" }
   Si no hay memoria previa, devuelve { memory: {} }.

3. save_agent_memory(game_id, team_id, memory)
   Persiste tu estado de deducción entre turnos.
   El parámetro memory es un JSON string (stringify antes de enviar).
   Llámala después de cada turno para no perder tu razonamiento acumulado.

## Valores canónicos del juego
Los valores exactos los proporciona get_game_state en cada llamada.
Usa UNICAMENTE los nombres tal como aparecen en la respuesta de get_game_state.

## Reglas clave
El motor te invocará con dos tipos de solicitud:

- play_turn: debes elegir una acción (sugerencia, acusación o pase).
- refute: debes decidir si puedes refutar la sugerencia recibida y, si es así, qué carta mostrar.

Responde siempre con el formato JSON correcto para cada modo.
El motor rechaza cualquier respuesta que no sea JSON válido con los campos exactos.

## Formato de respuesta
Responde UNICAMENTE con un objeto JSON válido, sin texto adicional.

Modo play_turn:
  Sugerencia: {"action":"suggestion","sospechoso":"...","arma":"...","escenario":"...","spectatorComment":"..."}
  Acusación:  {"action":"accusation","sospechoso":"...","arma":"...","escenario":"...","spectatorComment":"..."}
  Pase:       {"action":"pass","spectatorComment":"..."}

Modo refute:
  Mostrar carta: {"action":"show_card","carta":"NombreExactoDeLaCarta","spectatorComment":"..."}
  No puede refutar: {"action":"cannot_refute","spectatorComment":"..."}

spectatorComment: campo opcional (max. 160 caracteres, sin saltos de linea).
Es visible para los espectadores en la Arena durante la partida.`;

const SEQUENCE_DIAGRAM_MERMAID = `sequenceDiagram
    autonumber
    participant M as Motor de juego
    participant A as Agente
    M->>A: invocar play_turn
    A->>M: get_game_state(game_id, team_id)
    M-->>A: GameStateView filtrada
    A->>M: get_agent_memory(game_id, team_id)
    M-->>A: { memory: { ... } }
    Note over A: Razona con estado y memoria
    opt Persistencia opcional
      A->>M: save_agent_memory({ ... })
      M-->>A: { ok: true }
    end
    A-->>M: AgentResponse { action: "..." }
    Note over M: Valida y aplica la acción`;

const FAQ_ROWS = [
  {
    error: 'EVT_INVALID_FORMAT en todos los turnos',
    cause: 'La respuesta no es JSON plano o falta el campo action.',
    solution: 'Devuelve exactamente el objeto AgentResponse sin texto ni envolturas extra.',
  },
  {
    error: 'EVT_INVALID_CARD en la primera sugerencia',
    cause: 'Nombre con mayúscula, tilde o espacio distinto al canónico.',
    solution: 'Lee get_game_state y copia literalmente los nombres válidos.',
  },
  {
    error: 'historial: [] siempre vacío',
    cause: 'Puede ocurrir en versiones previas del motor con el bug abierto de historial.',
    solution: 'Diseña el agente para degradar bien aunque el historial llegue vacío.',
  },
  {
    error: '401 Unauthorized',
    cause: 'TEAM_MCP_TOKEN incorrecto o con espacios adicionales.',
    solution: 'Verifica que se envía como Bearer <token> sin espacios extra.',
  },
  {
    error: 'cannot_refute cuando sí tiene carta',
    cause: 'Comparación de nombres no exacta.',
    solution: 'Usa comparación estricta y los nombres canónicos exactos.',
  },
  {
    error: 'EVT_TIMEOUT frecuente',
    cause: 'El modelo tarda demasiado en responder.',
    solution: 'Recorta prompt, simplifica estrategia o usa un modelo más rápido.',
  },
  {
    error: 'EVT_REDUNDANT_SUGGESTION repetido',
    cause: 'Se repite la misma tripla en turnos distintos.',
    solution: 'Guarda sugerencias previas en save_agent_memory y exclúyelas al decidir.',
  },
];

const QUICKSTART_STEPS = [
  {
    title: 'Crea una aplicación en MattinAI',
    body: 'Abre una aplicación nueva para agrupar el agente, sus prompts y las integraciones MCP del evento.',
  },
  {
    title: 'Registra el MCP de Clue Arena',
    body: 'Añade el servidor MCP del evento y concede acceso a tu agente. La organización te facilitará URL y API key.',
  },
  {
    title: 'Pega el system prompt base',
    body: 'Usa el prompt de esta guía como base fija y deja la estrategia competitiva en el user prompt o prompt template.',
  },
  {
    title: 'Guarda APP ID, Agent ID y API Key',
    body: 'Son los tres datos que Clue Arena necesita para invocar tu agente en producción.',
  },
  {
    title: 'Prueba y entrena',
    body: 'Conecta el agente en la ficha del equipo y usa la zona de entrenamiento antes del evento.',
  },
];

const LAUNCH_CHECKLIST = [
  'El agente responde solo con JSON válido.',
  'Los nombres de cartas se copian de get_game_state.',
  'La memoria se guarda tras cada turno útil.',
  'Las sugerencias repetidas se evitan con estado persistido.',
];

export default async function InstruccionesPage() {
  const t = await getTranslations('instrucciones');
  const tJuego = await getTranslations('juego');
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
  const mcpToken = process.env.MCP_AUTH_TOKEN?.trim() || '';
  const maskedMcpToken = maskSecret(mcpToken);
  const mattinMcpConfig = `{
  "clue-arena": {
    "url": "${appBaseUrl}/api/mcp",
    "transport": "http",
    "headers": {
      "X-API-KEY": "${maskedMcpToken}"
    }
  }
}`;

  return (
    <InstructionsLayout>
      <section
        id="intro"
        className="scroll-mt-20 overflow-hidden rounded-[32px] border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_35%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(145deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.92))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55)] md:p-10"
      >
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-5xl">
                {tJuego('subtitulo')}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                {t('heroBannerDesc')}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <HeroMetric
                icon={<Bot className="h-4 w-4" />}
                label="Entrada esperada"
                value="play_turn / refute"
                tone="cyan"
              />
              <HeroMetric
                icon={<DatabaseZap className="h-4 w-4" />}
                label="Tools MCP"
                value="3 herramientas"
                tone="emerald"
              />
              <HeroMetric
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Salida obligatoria"
                value="JSON estricto"
                tone="amber"
              />
            </div>

            <div className="grid gap-4">
              <HighlightPanel
                title="Lo esencial para competir"
                description="Si tu equipo solo recuerda una cosa, que sea esta: el motor tolera poca ambigüedad. Prompt claro, nombres canónicos exactos y respuesta JSON limpia."
                icon={<Sparkles className="h-4 w-4" />}
              >
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  {LAUNCH_CHECKLIST.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 rounded-2xl border border-white/8 bg-white/5 px-3 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </HighlightPanel>

              <aside className="rounded-[28px] border border-white/10 bg-slate-950/50 p-5 backdrop-blur">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <ClipboardCheck className="h-4 w-4 text-amber-300" />
                  Camino recomendado
                </div>
                <div className="space-y-3">
                  {QUICKSTART_STEPS.map((step, index) => (
                    <div key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/15 text-xs text-amber-200">
                          {index + 1}
                        </span>
                        {step.title}
                      </div>
                      <p className="text-sm leading-6 text-slate-400">{step.body}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[28px] border border-cyan-400/15 bg-slate-950/70 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <BrainCircuit className="h-4 w-4" />
                Arquitectura mental del agente
              </div>
              <div className="space-y-3">
                <FlowStep
                  title="Lee el estado"
                  description="Consulta get_game_state para obtener tus cartas, turno, historial y nombres válidos."
                />
                <FlowStep
                  title="Recupera memoria"
                  description="Carga lo que ya dedujiste en turnos anteriores para no empezar de cero."
                />
                <FlowStep
                  title="Decide la jugada"
                  description="Sugerencia, acusación, pase o refutación según el modo invocado."
                />
                <FlowStep
                  title="Persiste contexto"
                  description="Guarda deducciones y evita repeticiones con save_agent_memory."
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-amber-400/15 bg-[linear-gradient(180deg,_rgba(120,53,15,0.28),_rgba(15,23,42,0.72))] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Trophy className="h-4 w-4" />
                Qué premia la arena
              </div>
              <p className="text-sm leading-6 text-slate-300">
                La puntuación recompensa precisión y velocidad, pero castiga duro los errores estructurales.
                Un agente sobrio y consistente suele rendir mejor que uno brillante pero inestable.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniNote label="+ precisión" value="Acusar solo cuando la hipótesis esté madura." />
                <MiniNote label="+ eficiencia" value="Resolver en pocos turnos propios suma bonus." />
                <MiniNote label="- formato" value="JSON incorrecto consume turno y penaliza." />
                <MiniNote label="- repetición" value="Duplicar sugerencias cuesta puntos evitables." />
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionWrapper id="quickstart" title={t('sec8Titulo')} titleNumber="1">
        <div className="grid gap-4 lg:grid-cols-2">
          {QUICKSTART_STEPS.map((step, index) => (
            <StepCard key={step.title} index={index + 1} title={step.title}>
              <p className="text-sm leading-6 text-slate-400">{step.body}</p>
            </StepCard>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <HighlightPanel
            title="Configuración MCP de la app"
            description="El endpoint MCP vive en la URL pública actual de Clue Arena. La autenticación entrante puede validarse por API key y este ejemplo usa la cabecera X-API-KEY."
            icon={<KeyRound className="h-4 w-4" />}
          >
            <CodeBlock code={mattinMcpConfig} language="json" filename="mcp-config.json" />
            <p className="text-xs leading-5 text-slate-500">
              El token mostrado está redactado a propósito. La fuente real en servidor es
              <code className="mx-1 font-mono text-slate-300">MCP_AUTH_TOKEN</code>.
            </p>
          </HighlightPanel>

          <HighlightPanel
            title="Datos que luego registrarás en Clue Arena"
            description="Cuando el agente exista en MattinAI, tu equipo debe copiar exactamente estos tres identificadores."
            icon={<ClipboardCheck className="h-4 w-4" />}
          >
            <div className="space-y-3">
              <KeyValueItem label="APP ID" value="Identificador de la aplicación MattinAI" />
              <KeyValueItem label="Agent ID" value="Identificador del agente dentro de esa aplicación" />
              <KeyValueItem label="API Key" value="Clave privada para invocar el agente" />
            </div>
          </HighlightPanel>
        </div>

        <HighlightPanel
          title="System prompt base"
          description="Este bloque fija contrato, flujo de herramientas y formato de salida. Tu estrategia competitiva debe vivir aparte, en el user prompt o template."
          icon={<Bot className="h-4 w-4" />}
        >
          <CodeBlock code={SYSTEM_PROMPT} language="text" filename="system-prompt.txt" />
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Los campos <code className="font-mono text-amber-200">sospechoso</code>,{' '}
            <code className="font-mono text-amber-200">arma</code>,{' '}
            <code className="font-mono text-amber-200">escenario</code> y{' '}
            <code className="font-mono text-amber-200">carta</code> deben coincidir exactamente con el contrato.
          </div>
        </HighlightPanel>
      </SectionWrapper>

      <SectionWrapper id="como-funciona" title={t('sec2Titulo')} titleNumber="2">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <HighlightPanel
            title="Cuándo se invoca tu agente"
            description="El motor no te pide mover piezas: te pide decidir. Esa decisión vuelve como AgentResponse y el coordinador aplica la acción."
            icon={<Swords className="h-4 w-4" />}
          >
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Situación</th>
                    <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Modo</th>
                    <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Qué debe devolver</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-800/30">
                    <td className="border-b border-slate-800 px-4 py-3 text-slate-300">Es el turno del equipo</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-cyan-300">play_turn</td>
                    <td className="border-b border-slate-800 px-4 py-3 text-slate-300">Sugerencia, acusación o pase</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="border-b border-slate-800 px-4 py-3 text-slate-300">Puede refutar a otro equipo</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-cyan-300">refute</td>
                    <td className="border-b border-slate-800 px-4 py-3 text-slate-300">Mostrar carta o indicar que no puede</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </HighlightPanel>

          <HighlightPanel
            title="Secuencia completa de un turno"
            description="Este orden es la coreografía recomendada. Ayuda a que el agente sea consistente y fácil de depurar."
            icon={<ChevronRight className="h-4 w-4" />}
          >
            <MermaidDiagram chart={SEQUENCE_DIAGRAM_MERMAID} />
          </HighlightPanel>
        </div>

        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-4 text-sm text-slate-300">
          <strong className="text-cyan-200">Importante:</strong> el agente no ejecuta herramientas para
          sugerir o acusar. Solo devuelve un <code className="font-mono text-cyan-200">AgentResponse</code> válido.
        </div>
      </SectionWrapper>

      <SectionWrapper id="herramientas" title={t('sec4Titulo')} titleNumber="4">
        <div className="grid gap-4 md:grid-cols-3">
          <ToolSummary name="get_game_state" summary="Estado filtrado de la partida para tu equipo." />
          <ToolSummary name="get_agent_memory" summary="Memoria persistida entre invocaciones." />
          <ToolSummary name="save_agent_memory" summary="Persistencia del razonamiento acumulado." />
        </div>

        <ToolPanel
          name="get_game_state"
          description="Devuelve el estado de la partida filtrado para tu equipo. Solo ves tus cartas y el historial público."
          footer="cartaMostrada solo aparece para el equipo que realizó la sugerencia y recibió esa carta."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Entrada</p>
              <CodeBlock code={GAME_STATE_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Respuesta</p>
              <CodeBlock code={GAME_STATE_OUTPUT} language="json" />
            </div>
          </div>
        </ToolPanel>

        <ToolPanel
          name="get_agent_memory"
          description="Recupera libreta, hipótesis y descartes que guardaste en turnos anteriores."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Entrada</p>
              <CodeBlock code={MEMORY_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Respuesta</p>
              <CodeBlock code={MEMORY_OUTPUT} language="json" />
            </div>
          </div>
        </ToolPanel>

        <ToolPanel
          name="save_agent_memory"
          description="Guarda deducciones y contexto del turno para evitar perder razonamiento entre llamadas."
          footer="Límite recomendado por partida y equipo: 64 KB."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Entrada</p>
              <CodeBlock code={SAVE_MEMORY_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Respuesta</p>
              <CodeBlock code={SAVE_MEMORY_OUTPUT} language="json" />
            </div>
          </div>
        </ToolPanel>
      </SectionWrapper>

      <SectionWrapper id="respuesta" title={t('sec5Titulo')} titleNumber="5">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <HighlightPanel
            title="Contrato AgentResponse"
            description="El motor espera exactamente esta forma. Cualquier desviación puede terminar en EVT_INVALID_FORMAT."
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <CodeBlock code={AGENT_RESPONSE_SCHEMA} language="typescript" />
          </HighlightPanel>

          <HighlightPanel
            title="Acciones válidas por modo"
            description="Cada modo admite un subconjunto distinto de acciones. Mezclarlos produce error de formato."
            icon={<ClipboardCheck className="h-4 w-4" />}
          >
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Modo</th>
                    <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Válidas</th>
                    <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Inválidas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-800/30">
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-cyan-300">play_turn</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-emerald-300">suggestion · accusation · pass</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-rose-300">show_card · cannot_refute</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-cyan-300">refute</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-emerald-300">show_card · cannot_refute</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-rose-300">suggestion · accusation · pass</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </HighlightPanel>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ExampleCard title="Sugerencia" code={EXAMPLE_SUGGESTION} />
          <ExampleCard title="Acusación" code={EXAMPLE_ACCUSATION} />
          <ExampleCard title="Pase" code={EXAMPLE_PASS} />
          <ExampleCard title="Mostrar carta" code={EXAMPLE_SHOW_CARD} />
          <ExampleCard title="No puede refutar" code={EXAMPLE_CANNOT_REFUTE} />
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          En <code className="font-mono text-amber-200">show_card</code>, la carta debe ser una de tus cartas
          propias y formar parte de la sugerencia que estás refutando.
        </div>
      </SectionWrapper>

      <SectionWrapper id="elementos" title={t('sec6Titulo')} titleNumber="6">
        <HighlightPanel
          title="Usa siempre valores canónicos"
          description="Mayúsculas, tildes y espacios forman parte del contrato. Si el nombre no coincide exactamente, el motor penaliza con EVT_INVALID_CARD."
          icon={<Sparkles className="h-4 w-4" />}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <MiniNote label="Sospechosos" value="6 nombres cerrados y exactos." />
            <MiniNote label="Armas" value="6 opciones válidas del evento." />
            <MiniNote label="Escenarios" value="9 habitaciones canónicas." />
          </div>
        </HighlightPanel>

        <h3 className="mt-2 text-lg font-semibold text-slate-200">Sospechosos</h3>
        <SuspectsTable />

        <h3 className="mt-2 text-lg font-semibold text-slate-200">Armas</h3>
        <WeaponsTable />

        <h3 className="mt-2 text-lg font-semibold text-slate-200">Escenarios</h3>
        <ScenariosTable />
      </SectionWrapper>

      <SectionWrapper id="puntuacion" title={t('sec7Titulo')} titleNumber="7">
        <ScoringTable />

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <HighlightPanel
            title="Bonus de eficiencia"
            description="Solo lo recibe el ganador. Premia resolver el caso en pocos turnos propios."
            icon={<Trophy className="h-4 w-4" />}
          >
            <CodeBlock
              language="text"
              code={`EVT_WIN_EFFICIENCY = max(0, 500 - (T - T_min) x 25)\n\ndonde:\n  T      = turnos propios jugados hasta la acusación correcta\n  T_min  = 2\n  umbral = 22 turnos propios -> bonificación = 0`}
            />
          </HighlightPanel>

          <HighlightPanel
            title="Implicaciones de diseño"
            description="Estas decisiones de UX del juego deben reflejarse en la estrategia de tu agente."
            icon={<BrainCircuit className="h-4 w-4" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ChecklistItem text="No acuses sin certeza: fallar elimina y penaliza fuerte." />
              <ChecklistItem text="Varía sugerencias para no pagar redundancia." />
              <ChecklistItem text="Responde siempre en JSON estricto." />
              <ChecklistItem text="Refuta cuando puedas: también suma." />
              <ChecklistItem text="No declares cannot_refute si sí tienes carta." />
              <ChecklistItem text="Evita pases innecesarios." />
            </div>
          </HighlightPanel>
        </div>
      </SectionWrapper>

      <SectionWrapper id="registro" title={t('sec9Titulo')} titleNumber="9">
        <div className="grid gap-4 lg:grid-cols-2">
          <StepCard index={1} title="Entra en Mi Equipo">
            <p className="text-sm leading-6 text-slate-400">
              Accede con las credenciales corporativas y abre la ficha operativa del equipo.
            </p>
          </StepCard>
          <StepCard index={2} title="Introduce credenciales">
            <p className="text-sm leading-6 text-slate-400">
              Rellena <code className="font-mono text-cyan-300">APP ID</code>,{' '}
              <code className="font-mono text-cyan-300">Agent ID</code> y{' '}
              <code className="font-mono text-cyan-300">API Key</code>.
            </p>
          </StepCard>
          <StepCard index={3} title="Verifica la conexión">
            <p className="text-sm leading-6 text-slate-400">
              Usa la comprobación integrada antes de dar el agente por bueno para el evento.
            </p>
          </StepCard>
          <StepCard index={4} title="Entrena antes del día real">
            <p className="text-sm leading-6 text-slate-400">
              Lanza partidas de práctica para revisar latencia, formato y calidad estratégica.
            </p>
          </StepCard>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
          Los agentes locales o expuestos solo en <code className="font-mono text-rose-200">localhost</code> no
          sirven para producción del evento.
        </div>
      </SectionWrapper>

      <SectionWrapper id="faq" title={t('sec10Titulo')} titleNumber="10">
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Errores frecuentes y soluciones</caption>
            <thead>
              <tr>
                <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Error / situación</th>
                <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Causa probable</th>
                <th className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300">Solución</th>
              </tr>
            </thead>
            <tbody>
              {FAQ_ROWS.map((row) => (
                <tr key={row.error} className="hover:bg-slate-800/30">
                  <td className="border-b border-slate-800 px-4 py-3 align-top text-amber-300">{row.error}</td>
                  <td className="border-b border-slate-800 px-4 py-3 align-top text-slate-400">{row.cause}</td>
                  <td className="border-b border-slate-800 px-4 py-3 align-top text-slate-300">{row.solution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
          Si después de entrenar todavía tienes dudas, el canal oficial del evento debe ser tu siguiente punto de apoyo.
        </div>
      </SectionWrapper>
    </InstructionsLayout>
  );
}

function maskSecret(secret: string) {
  if (!secret) return '<MCP_AUTH_TOKEN>';
  if (secret.length <= 4) return '****';
  return `${secret.slice(0, 2)}${'•'.repeat(Math.max(secret.length - 4, 4))}${secret.slice(-2)}`;
}

function HeroMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'cyan' | 'emerald' | 'amber';
}) {
  const toneClasses = {
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function HighlightPanel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-950/55 p-5 backdrop-blur">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function StepCard({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-800 bg-slate-950/55 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-200">
          {index}
        </span>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FlowStep({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 px-4 py-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <ChevronRight className="h-4 w-4 text-cyan-300" />
        {title}
      </div>
      <p className="text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function MiniNote({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function KeyValueItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function ToolSummary({ name, summary }: { name: string; summary: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
      <p className="font-mono text-sm font-bold text-cyan-300">{name}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{summary}</p>
    </div>
  );
}

function ToolPanel({
  name,
  description,
  footer,
  children,
}: {
  name: string;
  description: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-950/55 p-5">
      <div className="mb-4">
        <h3 className="font-mono text-base font-bold text-cyan-300">{name}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {children}
      {footer ? <p className="mt-4 text-xs leading-5 text-slate-500">{footer}</p> : null}
    </div>
  );
}

function ExampleCard({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-[24px] border border-slate-800 bg-slate-950/55 p-4">
      <p className="mb-2 text-sm font-semibold text-slate-200">{title}</p>
      <CodeBlock code={code} language="json" />
    </div>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      <span className="text-sm leading-6 text-slate-300">{text}</span>
    </div>
  );
}
