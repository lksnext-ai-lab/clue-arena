'use client';

/**
 * TrainingReplayPlayer — Step-by-step replay of a finished training game.
 *
 * Displays each turn as a "step" with three side-by-side panels:
 *   1. 🤖 Agente    — Team's AI agent interaction (LLM exchanges, memory, action).
 *   2. 🔄 Coordinador — Orchestration layer (game state view, request/response flow).
 *   3. 🎲 Bot        — Bot participant activity for this turn.
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import type {
  TrainingTurnResponse,
  AgentInteractionTrace,
  AgentLlmExchange,
  AgentToolCall,
  AgentAction,
  AgentResponse,
  RefutacionRecord,
} from '@/types/api';

// ─── Text inspector modal ────────────────────────────────────────────────────

interface TextInspectorModalProps {
  label: string;
  text: string;
  onClose: () => void;
}

function TextInspectorModal({ label, text, onClose }: TextInspectorModalProps) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll and focus close button
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
        <span className="text-sm font-semibold text-slate-200 truncate max-w-[70vw]">{label}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            title={copied ? 'Copiado' : 'Copiar todo'}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:text-white hover:border-slate-400 transition"
          >
            {copied ? '✓' : '⎘'}
          </button>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:text-white hover:border-red-500 transition"
          >
            ✕
          </button>
        </div>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-auto scrollbar-code p-6">
        <pre className="whitespace-pre-wrap break-words text-sm text-slate-200 leading-relaxed font-mono">
          {text}
        </pre>
      </div>
      {/* Footer hint */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900/80 px-4 py-2 text-center text-xs text-slate-600">
        Pulsa <kbd className="rounded border border-slate-700 bg-slate-800 px-1">Esc</kbd> o haz clic fuera para cerrar
      </div>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const CHAR_LIMIT = 400;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title={copied ? 'Copiado' : 'Copiar'}
    className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:border-slate-400 transition"
    >
      {copied ? '✓' : '⎘'}
    </button>
  );
}

function ExpandableText({ text, label }: { text: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const truncated = text.length > CHAR_LIMIT && !expanded;
  const display = truncated ? text.slice(0, CHAR_LIMIT) + '…' : text;
  return (
    <>
      {maximized && (
        <TextInspectorModal label={label} text={text} onClose={() => setMaximized(false)} />
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-300">{label}</span>
          <div className="flex gap-2">
            <CopyButton text={text} />
            <button
              onClick={() => setMaximized(true)}
              className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:border-slate-400 transition"
              title="Maximizar"
            >
              ⛶
            </button>
            {text.length > CHAR_LIMIT && (
              <button
                onClick={() => setExpanded((e) => !e)}
                title={expanded ? 'Comprimir' : 'Expandir'}
                className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-white transition"
              >
                {expanded ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>
        <pre className="scrollbar-code overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-300 border border-slate-700 max-h-44 whitespace-pre-wrap">
          {display}
        </pre>
      </div>
    </>
  );
}

function JsonView({ data, label }: { data: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const text = JSON.stringify(data, null, 2);
  return (
    <>
      {maximized && (
        <TextInspectorModal label={label} text={text} onClose={() => setMaximized(false)} />
      )}
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors w-full text-left"
        >
          <span>{open ? '▼' : '▶'}</span>
          <span className="font-medium">{label}</span>
        </button>
        {open && (
          <div className="mt-1">
            <div className="flex justify-end gap-2 mb-1">
              <CopyButton text={text} />
              <button
                onClick={() => setMaximized(true)}
                className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:border-slate-400 transition"
                title="Maximizar"
              >
                ⛶
              </button>
            </div>
            <pre className="scrollbar-code overflow-auto rounded bg-slate-950 p-2 text-xs text-green-300 border border-slate-700 max-h-60">
              {text}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}

function getActionLabel(action: AgentAction | undefined): string {
  if (!action) return 'Sin acción';
  if (action.type === 'suggestion') return '🔍 Sugerencia';
  if (action.type === 'accusation') return '⚖️ Acusación';
  if (action.type === 'pass') return '⏭ Pase';
  if (action.type === 'show_card') return '🃏 Mostrar carta';
  if (action.type === 'cannot_refute') return '🚫 Sin refutación';
  return (action as { type: string }).type;
}

function ActionBadge({ action }: { action: AgentAction | undefined }) {
  if (!action) return <span className="text-slate-500 text-xs italic">Sin acción registrada</span>;

  const color =
    action.type === 'accusation'
      ? 'bg-red-900/40 text-red-300 border-red-700/60'
      : action.type === 'suggestion'
      ? 'bg-blue-900/40 text-blue-300 border-blue-700/60'
      : action.type === 'pass'
      ? 'bg-slate-700 text-slate-300 border-slate-600'
      : action.type === 'show_card'
      ? 'bg-amber-900/40 text-amber-300 border-amber-700/60'
      : 'bg-slate-700 text-slate-300 border-slate-600';

  return (
    <div className={`inline-flex flex-col gap-1 rounded border px-2 py-1 text-xs ${color}`}>
      <span className="font-semibold">{getActionLabel(action)}</span>
      {(action.type === 'suggestion' || action.type === 'accusation') && (
        <span className="font-mono text-[11px]">
          {(action as { suspect: string }).suspect} ·{' '}
          {(action as { weapon: string }).weapon} ·{' '}
          {(action as { room: string }).room}
        </span>
      )}
      {action.type === 'show_card' && (
        <span className="font-mono text-[11px]">{(action as { card: string }).card}</span>
      )}
    </div>
  );
}

// ─── Refutation summary block ────────────────────────────────────────────────

function RefutacionBlock({
  refutacion,
  allEquipoId,
}: {
  refutacion: RefutacionRecord;
  allEquipoId: string;
}) {
  if (refutacion.refutadaPor === null) {
    return (
      <div className="rounded border border-slate-600/60 bg-slate-800/40 px-3 py-2 text-xs">
        <p className="font-semibold text-slate-300 mb-1">Resultado de refutación</p>
        <p className="text-slate-400">🔓 Nadie pudo refutar — ningún equipo tenía las cartas.</p>
      </div>
    );
  }
  const refutorLabel =
    refutacion.refutadaPor === allEquipoId
      ? 'Tu equipo'
      : refutacion.refutadaPor.startsWith('bot-')
      ? `Bot ${refutacion.refutadaPor.replace('bot-', '')}`
      : refutacion.refutadaPor;
  return (
    <div className="rounded border border-amber-700/40 bg-amber-900/10 px-3 py-2 text-xs">
      <p className="font-semibold text-amber-300 mb-1">Resultado de refutación</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-300">Refutó:</span>
        <span className="font-semibold text-amber-200">{refutorLabel}</span>
        {refutacion.cartaMostrada && (
          <>
            <span className="text-slate-400">carta:</span>
            <span className="rounded bg-amber-900/40 px-2 py-0.5 font-medium text-amber-200">
              {refutacion.cartaMostrada}
            </span>
          </>
        )}
      </div>
      {refutacion.razonamiento && refutacion.razonamiento !== 'parse_error' && (
        <details className="mt-2">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-300 transition">
            Razonamiento del refutador ▸
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-slate-900/60 p-2 text-slate-300 leading-relaxed">
            {refutacion.razonamiento}
          </pre>
        </details>
      )}
    </div>
  );
}

// ─── Panel: Agente ───────────────────────────────────────────────────────────

function JsonField({ label, data }: { label: string; data: unknown }) {
  const [maximized, setMaximized] = useState(false);
  const text = JSON.stringify(data, null, 2);
  return (
    <>
      {maximized && (
        <TextInspectorModal label={label} text={text} onClose={() => setMaximized(false)} />
      )}
      <div className="min-w-0 w-full">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-slate-500">{label}</span>
          <div className="flex gap-1">
            <CopyButton text={text} />
            <button
              onClick={() => setMaximized(true)}
              title="Maximizar"
              className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-500 hover:text-white hover:border-slate-400 transition"
            >
              ⛶
            </button>
          </div>
        </div>
        <pre className="scrollbar-code overflow-auto rounded bg-black/30 p-1 text-green-300 max-h-28 text-xs w-full whitespace-pre">
          {text}
        </pre>
      </div>
    </>
  );
}

function ToolCallRow({ call, index }: { call: AgentToolCall; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 rounded border border-slate-700 bg-slate-900 p-2 text-xs">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-mono font-semibold text-blue-300 truncate mr-2">
          {index + 1}. {call.tool}
        </span>
        <span className="shrink-0 text-slate-500">⏱ {call.durationMs}ms {open ? '▲' : '▶'}</span>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 min-w-0">
          <JsonField label="Args:" data={call.args} />
          <JsonField label="Resultado:" data={call.result} />
        </div>
      )}
    </div>
  );
}

function LlmExchangeCard({
  exchange,
  index,
  showSystemPrompt,
}: {
  exchange: AgentLlmExchange;
  index: number;
  showSystemPrompt: boolean;
}) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="rounded border border-slate-600 p-3 bg-slate-800/50">
      <div
        className="flex cursor-pointer items-center justify-between mb-2"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-medium text-white">Iteración LLM {index + 1}</span>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>⏱ {exchange.durationMs}ms</span>
          <span>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          {showSystemPrompt && (
            <ExpandableText text={exchange.systemPrompt} label="System prompt" />
          )}
          <ExpandableText text={exchange.userPrompt} label="Mensaje al LLM" />
          {exchange.toolCalls.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-300">
                Tool calls ({exchange.toolCalls.length})
              </p>
              <div className="flex flex-col gap-1">
                {exchange.toolCalls.map((tc, i) => (
                  <ToolCallRow key={i} call={tc} index={i} />
                ))}
              </div>
            </div>
          )}
          <ExpandableText text={exchange.rawResponse} label="Respuesta del LLM" />
        </div>
      )}
    </div>
  );
}

function memoryDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before && !after) return [];
  if (!before) return Object.keys(after ?? {}).map((k) => `+ ${k}: ${JSON.stringify((after ?? {})[k])}`);
  if (!after) return Object.keys(before).map((k) => `- ${k}: eliminado`);
  const diffs: string[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const prev = JSON.stringify(before[key]);
    const curr = JSON.stringify(after[key]);
    if (prev === undefined) diffs.push(`+ ${key}: ${curr}`);
    else if (curr === undefined) diffs.push(`- ${key}: eliminado`);
    else if (prev !== curr) diffs.push(`~ ${key}: ${prev} → ${curr}`);
  }
  return diffs;
}

function MemoryDiffBlock({ lines }: { lines: string[] }) {
  const [maximized, setMaximized] = useState(false);
  const text = lines.join('\n');
  return (
    <>
      {maximized && (
        <TextInspectorModal label="Diff de memoria" text={text} onClose={() => setMaximized(false)} />
      )}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-slate-400">Diff de memoria</p>
          <div className="flex gap-1">
            <CopyButton text={text} />
            <button
              onClick={() => setMaximized(true)}
              title="Maximizar"
              className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-500 hover:text-white hover:border-slate-400 transition"
            >
              ⛶
            </button>
          </div>
        </div>
        <pre className="scrollbar-code overflow-auto rounded bg-slate-950 p-2 text-xs text-green-300 border border-slate-700 max-h-32 w-full whitespace-pre">
          {text}
        </pre>
      </div>
    </>
  );
}

function AgentPanel({
  turn,
  equipoId,
}: {
  turn: TrainingTurnResponse;
  equipoId: string;
}) {
  const isRealTeamTurn = !turn.esBot && turn.equipoId === equipoId;
  const trace: AgentInteractionTrace | null = turn.agentTrace ?? null;
  const diffLines = memoryDiff(turn.memoriaInicial ?? null, turn.memoriaFinal ?? null);
  const parsedAction = (turn.accion as AgentResponse | null)?.action;

  if (!isRealTeamTurn) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-500">
        <span className="text-2xl">🤖</span>
        <p className="text-xs">Turno de bot</p>
        <p className="text-xs text-slate-600">El agente real no interviene en este turno.</p>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-500">
        <span className="text-2xl">🤖</span>
        <p className="text-xs">Sin traza de agente disponible para este turno.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Memory initial */}
      {turn.memoriaInicial && (
        <JsonView data={turn.memoriaInicial} label="Memoria al inicio del turno" />
      )}

      {/* LLM exchanges */}
      <div className="flex flex-col gap-2">
        {trace.exchanges.map((ex, i) => (
          <LlmExchangeCard
            key={i}
            exchange={ex}
            index={i}
            showSystemPrompt={trace.backendType !== 'mattin'}
          />
        ))}
      </div>

      {/* Parsed action */}
      <div className="rounded border border-slate-600 px-3 py-2">
        <p className="mb-1 text-xs text-slate-400">Acción resultante</p>
        {trace.parsedAction ? (
          <ActionBadge action={trace.parsedAction.action} />
        ) : (
          <span className="text-xs text-red-400">
            ❌ Error de parsing: {trace.parseError}
          </span>
        )}
      </div>

      {/* Reasoning */}
      {(turn.accion as AgentResponse | null)?.reasoning && (
        <ExpandableText
          text={(turn.accion as AgentResponse).reasoning}
          label="Razonamiento del agente"
        />
      )}

      {/* Memory final */}
      {turn.memoriaFinal && (
        <JsonView data={turn.memoriaFinal} label="Memoria al final del turno" />
      )}

      {/* Memory diff */}
      {diffLines.length > 0 && (
        <MemoryDiffBlock lines={diffLines} />
      )}

      {parsedAction && (
        <div className="mt-auto">
          <p className="mb-1 text-xs text-slate-400">Acción aplicada al motor</p>
          <ActionBadge action={parsedAction} />
        </div>
      )}
    </div>
  );
}

// ─── Panel: Coordinador ──────────────────────────────────────────────────────

function CoordinatorPanel({ turn, equipoId }: { turn: TrainingTurnResponse; equipoId: string }) {
  const trace: AgentInteractionTrace | null = turn.agentTrace ?? null;
  const totalToolCalls = trace?.totalToolCalls ?? 0;
  const action = (turn.accion as AgentResponse | null)?.action;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Metadata flow */}
      <div className="rounded border border-purple-800/40 bg-slate-800/60 p-3 space-y-2">
        <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
          Flujo de orquestación
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-slate-700/60 px-2 py-1">
            <span className="text-slate-400">Tipo de solicitud</span>
            <p className="font-mono text-white mt-0.5">
              {trace?.type ?? (turn.esBot ? 'bot (local)' : 'desconocido')}
            </p>
          </div>
          <div className="rounded bg-slate-700/60 px-2 py-1">
            <span className="text-slate-400">Duración total</span>
            <p className="font-mono text-white mt-0.5">
              {turn.durationMs != null ? `${turn.durationMs} ms` : '—'}
            </p>
          </div>
          <div className="rounded bg-slate-700/60 px-2 py-1">
            <span className="text-slate-400">Iteraciones LLM</span>
            <p className="font-mono text-white mt-0.5">{trace?.exchanges.length ?? (turn.esBot ? 1 : 0)}</p>
          </div>
          <div className="rounded bg-slate-700/60 px-2 py-1">
            <span className="text-slate-400">Total tool calls</span>
            <p className="font-mono text-white mt-0.5">{totalToolCalls}</p>
          </div>
        </div>
      </div>

      {/* Sequence diagram (textual) */}
      <div className="rounded border border-purple-800/30 bg-slate-800/40 p-3">
        <p className="text-xs font-semibold text-purple-300 mb-2 uppercase tracking-wider">
          Secuencia de mensajes
        </p>
        <ol className="text-xs text-slate-400 space-y-1 list-none">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">1.</span>
            <span>Motor de juego → Coordinador (<span className="font-mono text-slate-200">play_turn</span> / <span className="font-mono text-slate-200">refute</span>)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">2.</span>
            <span>Coordinador → {turn.esBot ? 'Bot local (Genkit)' : 'Agente via MCP'} (petición con GameStateView)</span>
          </li>
          {totalToolCalls > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">3.</span>
              <span>Agente llama {totalToolCalls} herramienta(s) MCP (get_game_state, memoria…)</span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">{totalToolCalls > 0 ? '4' : '3'}.</span>
            <span>
              Agente → Coordinador (acción: <span className="font-mono text-slate-200">{action?.type ?? '—'}</span>)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">{totalToolCalls > 0 ? '5' : '4'}.</span>
            <span>Coordinador → Motor de juego (acción validada y aplicada)</span>
          </li>
        </ol>
      </div>

      {/* GameStateView */}
      {turn.gameStateView != null && (
        <JsonView data={turn.gameStateView} label="GameStateView enviado al agente" />
      )}

      {/* Action sent back */}
      {action && (
        <div>
          <p className="mb-1 text-xs text-slate-400">Respuesta devuelta al motor</p>
          <ActionBadge action={action} />
        </div>
      )}

      {/* Refutation outcome (suggestion turns only) */}
      {action?.type === 'suggestion' && turn.refutacion !== undefined && (
        <RefutacionBlock
          refutacion={turn.refutacion ?? { refutadaPor: null, cartaMostrada: null }}
          allEquipoId={equipoId}
        />
      )}
    </div>
  );
}

// ─── Panel: Bot ──────────────────────────────────────────────────────────────

function BotPanel({
  turn,
  allTurns,
  equipoId,
}: {
  turn: TrainingTurnResponse;
  allTurns: TrainingTurnResponse[];
  equipoId: string;
}) {
  const isBotTurn = turn.esBot;
  const action = (turn.accion as AgentResponse | null)?.action;

  if (isBotTurn) {
    // Main bot activity: this IS the bot's turn
    const botNum = turn.equipoId.replace('bot-', '');
    const reasoning = (turn.accion as AgentResponse | null)?.reasoning;
    return (
      <div className="flex flex-col gap-3 text-sm">
        <div className="rounded border border-orange-800/40 bg-slate-800/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
            🎲 Bot {botNum} — turno activo
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-700/60 px-2 py-1">
              <span className="text-slate-400">ID</span>
              <p className="font-mono text-white mt-0.5">{turn.equipoId}</p>
            </div>
            <div className="rounded bg-slate-700/60 px-2 py-1">
              <span className="text-slate-400">Duración</span>
              <p className="font-mono text-white mt-0.5">
                {turn.durationMs != null ? `${turn.durationMs} ms` : '—'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs text-slate-400">Acción del bot</p>
          <ActionBadge action={action} />
        </div>

        {reasoning && reasoning !== 'parse_error' && (
          <ExpandableText text={reasoning} label="Razonamiento (bot local)" />
        )}

        {/* Refutation outcome when this bot suggestion was resolved */}
        {action?.type === 'suggestion' && turn.refutacion !== undefined && (
          <RefutacionBlock
            refutacion={turn.refutacion ?? { refutadaPor: null, cartaMostrada: null }}
            allEquipoId={equipoId}
          />
        )}

        <div className="rounded border border-orange-800/20 bg-orange-900/10 p-2 text-xs text-orange-400/70">
          💡 El bot usa el modelo Genkit local. No hay traza MCP para turnos de bot.
        </div>
      </div>
    );
  }

  // Real team's turn — show summary of all bots' nearby actions
  const botTurns = allTurns.filter((t) => t.esBot);
  if (botTurns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-500">
        <span className="text-2xl">🎲</span>
        <p className="text-xs">Sin bots en esta partida.</p>
      </div>
    );
  }

  // Show the closest bot turns before and after this one
  const nearby = botTurns
    .map((t) => ({ t, dist: Math.abs(t.numero - turn.numero) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map((x) => x.t);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded border border-orange-800/30 bg-slate-800/40 p-3">
        <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider mb-1">
          Bots en espera
        </p>
        <p className="text-xs text-slate-400">Este turno lo juega el agente real. Los bots actúan en sus propios turnos.</p>
      </div>

      {/* If this is a suggestion and a bot refuted it, call it out */}
      {(turn.accion as AgentResponse | null)?.action?.type === 'suggestion' &&
        turn.refutacion?.refutadaPor?.startsWith('bot-') && (
          <RefutacionBlock
            refutacion={turn.refutacion}
            allEquipoId={equipoId}
          />
        )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400">Turnos de bot más cercanos</p>
        {nearby.map((bt) => {
          const bAction = (bt.accion as AgentResponse | null)?.action;
          const label = bt.numero < turn.numero ? '← anterior' : '→ siguiente';
          return (
            <div key={bt.id} className="rounded border border-slate-700 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-orange-300">
                  {bt.equipoId} — turno {bt.numero}
                </span>
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
              <ActionBadge action={bAction} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stepper controls ────────────────────────────────────────────────────────

interface StepperProps {
  current: number;    // 0-based
  total: number;
  onChange: (index: number) => void;
}

function Stepper({ current, total, onChange }: StepperProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(0)}
        disabled={current === 0}
        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
        title="Primer turno"
      >
        ⏮
      </button>
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 0}
        className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
        title="Turno anterior"
      >
        ‹ Anterior
      </button>
      <span className="text-xs text-slate-400 min-w-[80px] text-center">
        {current + 1} / {total}
      </span>
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total - 1}
        className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
        title="Turno siguiente"
      >
        Siguiente ›
      </button>
      <button
        onClick={() => onChange(total - 1)}
        disabled={current === total - 1}
        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
        title="Último turno"
      >
        ⏭
      </button>
    </div>
  );
}

// ─── Turn header ─────────────────────────────────────────────────────────────

function TurnHeader({
  turn,
  equipoId,
}: {
  turn: TrainingTurnResponse;
  equipoId: string;
}) {
  const isRealTeam = !turn.esBot && turn.equipoId === equipoId;
  const action = (turn.accion as AgentResponse | null)?.action;
  const isRefute = action?.type === 'show_card' || action?.type === 'cannot_refute';

  const teamLabel = turn.esBot
    ? `Bot ${turn.equipoId.replace('bot-', '')}`
    : 'Tu equipo';

  const teamColor = turn.esBot
    ? 'text-orange-300 bg-orange-900/20 border-orange-700/40'
    : 'text-indigo-300 bg-indigo-900/20 border-indigo-700/40';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
      <span className="text-lg font-bold text-white">Turno {turn.numero}</span>
      <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${teamColor}`}>
        {teamLabel}
      </span>
      {isRefute && (
        <span className="rounded border border-amber-700/40 bg-amber-900/20 px-2 py-0.5 text-xs text-amber-300">
          Refutación
        </span>
      )}
      {action && (
        <span className="text-xs text-slate-400">{getActionLabel(action)}</span>
      )}
      {turn.durationMs != null && (
        <span className="ml-auto text-xs text-slate-500">⏱ {turn.durationMs} ms</span>
      )}
      {!isRealTeam && !turn.esBot && (
        <span className="rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-400">
          otro equipo
        </span>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export interface TrainingReplayPlayerProps {
  turns: TrainingTurnResponse[];
  equipoId: string;
  gameId: string;
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderExplanation(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    // Headings
    if (line.startsWith('### ')) {
      return (
        <p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-indigo-300">
          {line.slice(4)}
        </p>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <p key={i} className="mt-3 mb-1 text-sm font-bold text-white">
          {line.slice(3)}
        </p>
      );
    }
    // Bullet / numbered list items
    const isBullet = line.startsWith('- ') || line.startsWith('* ');
    const numberMatch = line.match(/^(\d+)\. /);
    const content = isBullet
      ? line.slice(2)
      : numberMatch
      ? line.slice(numberMatch[0].length)
      : line;
    // Inline bold: **text**
    const parts: React.ReactNode[] = [];
    let rest = content;
    let key = 0;
    while (rest.length > 0) {
      const start = rest.indexOf('**');
      if (start === -1) {
        parts.push(rest);
        break;
      }
      if (start > 0) parts.push(rest.slice(0, start));
      const end = rest.indexOf('**', start + 2);
      if (end === -1) {
        parts.push(rest.slice(start));
        break;
      }
      parts.push(
        <strong key={key++} className="font-semibold text-slate-100">
          {rest.slice(start + 2, end)}
        </strong>,
      );
      rest = rest.slice(end + 2);
    }
    if (isBullet) {
      return (
        <li key={i} className="ml-3 list-disc text-slate-300 text-sm leading-relaxed">
          {parts}
        </li>
      );
    }
    if (numberMatch) {
      return (
        <li key={i} className="ml-3 list-decimal text-slate-300 text-sm leading-relaxed">
          {parts}
        </li>
      );
    }
    if (line.trim() === '') return <br key={i} />;
    return (
      <p key={i} className="text-slate-300 text-sm leading-relaxed">
        {parts}
      </p>
    );
  });
}

export function TrainingReplayPlayer({ turns, equipoId, gameId }: TrainingReplayPlayerProps) {
  const sorted = useMemo(
    () => [...turns].sort((a, b) => a.numero - b.numero),
    [turns],
  );
  const [stepIndex, setStepIndex] = useState(0);

  // ── Turn explainer state ──────────────────────────────────────────────────
  // Map from turn ID → explanation text (cache so we don't re-call the API)
  const [explanations, setExplanations] = useState<Map<string, string>>(new Map());
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const current = sorted[stepIndex] ?? null;

  // Clear error when user navigates between turns
  useEffect(() => { setExplainError(null); }, [stepIndex]);

  const currentExplanation = current ? explanations.get(current.id) ?? null : null;
  const handleExplain = useCallback(async () => {
    if (!current || explanations.has(current.id)) return;

    setExplaining(true);
    setExplainError(null);
    try {
      const data = await apiFetch<{ explanation: string; turnoId: string }>(
        `/training/games/${gameId}/turns/${current.id}/explain`,
        { method: 'POST' },
      );
      setExplanations((prev) => {
        const next = new Map(prev);
        next.set(current.id, data.explanation);
        return next;
      });
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Error al generar la explicación');
    } finally {
      setExplaining(false);
    }
  }, [current, explanations, gameId]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-8 text-center text-slate-400">
        No hay turnos para reproducir.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          ▶ Reproductor de partida
        </span>
        <Stepper
          current={stepIndex}
          total={sorted.length}
          onChange={setStepIndex}
        />
      </div>

      {/* Turn header */}
      <TurnHeader turn={current} equipoId={equipoId} />

      {/* 3-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel 1 — Agente */}
        <PanelWrapper
          title="🤖 Agente"
          accent="border-indigo-600/50"
          headerClass="text-indigo-400"
          subtitle={!current.esBot && current.equipoId === equipoId ? 'Agente real (MCP)' : 'No activo en este turno'}
        >
          <AgentPanel turn={current} equipoId={equipoId} />
        </PanelWrapper>

        {/* Panel 2 — Coordinador */}
        <PanelWrapper
          title="🔄 Coordinador"
          accent="border-purple-600/50"
          headerClass="text-purple-400"
          subtitle="Capa de orquestación MCP"
        >
          <CoordinatorPanel turn={current} equipoId={equipoId} />
        </PanelWrapper>

        {/* Panel 3 — Bot */}
        <PanelWrapper
          title="🎲 Bot"
          accent="border-orange-600/50"
          headerClass="text-orange-400"
          subtitle={current.esBot ? `Bot ${current.equipoId.replace('bot-', '')} activo` : 'Bots en espera'}
        >
          <BotPanel turn={current} allTurns={sorted} equipoId={equipoId} />
        </PanelWrapper>
      </div>

      {/* ── AI Turn Explainer ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-indigo-800/40 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-indigo-300">🧠 Explicador de turno con IA</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Análisis automático del turno {current.numero}: estrategia, decisión y puntos de mejora
            </p>
          </div>
          {!currentExplanation && (
            <button
              onClick={() => { void handleExplain(); }}
              disabled={explaining}
              className="flex items-center gap-2 rounded border border-indigo-600 bg-indigo-900/40 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-800/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {explaining ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
                  Analizando…
                </>
              ) : (
                'Explicar este turno'
              )}
            </button>
          )}
          {currentExplanation && (
            <button
              onClick={() => {
                setExplanations((prev) => {
                  const next = new Map(prev);
                  next.delete(current.id);
                  return next;
                });
              }}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:text-white hover:border-slate-400 transition"
              title="Limpiar explicación"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-4">
          {explainError && (
            <div className="rounded border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-400">
              ⚠️ {explainError}
            </div>
          )}

          {!currentExplanation && !explaining && !explainError && (
            <p className="text-xs text-slate-600 text-center py-4">
              Pulsa «Explicar este turno» para que la IA analice qué ocurrió y cómo mejorar el agente.
            </p>
          )}

          {explaining && (
            <div className="flex items-center justify-center gap-3 py-6 text-slate-400">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              <span className="text-sm">Generando análisis con IA…</span>
            </div>
          )}

          {currentExplanation && (
            <div className="space-y-0.5">
              {renderExplanation(currentExplanation)}
            </div>
          )}
        </div>
      </div>

      {/* Bottom stepper for convenience */}
      <div className="flex justify-center py-2">
        <Stepper
          current={stepIndex}
          total={sorted.length}
          onChange={setStepIndex}
        />
      </div>
    </div>
  );
}

// ─── Panel wrapper ───────────────────────────────────────────────────────────

function PanelWrapper({
  title,
  subtitle,
  accent,
  headerClass,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  headerClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border ${accent} bg-slate-800/50 flex flex-col overflow-hidden`}>
      <div className="border-b border-slate-700/60 px-4 py-3">
        <p className={`text-sm font-semibold ${headerClass}`}>{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="scrollbar-panel flex-1 overflow-y-auto p-4 max-h-[620px]">{children}</div>
    </div>
  );
}
