'use client';

import { useState } from 'react';
import type { AgentInteractionTrace, AgentLlmExchange, AgentToolCall } from '@/types/api';

interface TrainingAgentInteractionLogProps {
  trace: AgentInteractionTrace;
  memoriaInicial: Record<string, unknown> | null;
  memoriaFinal: Record<string, unknown> | null;
  turno: number;
}

const CHAR_LIMIT = 300;

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
      className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:border-slate-400 transition"
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

function ExpandableText({ text, label }: { text: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > CHAR_LIMIT && !expanded;
  const display = truncated ? text.slice(0, CHAR_LIMIT) + '…' : text;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <div className="flex gap-2">
          <CopyButton text={text} />
          {text.length > CHAR_LIMIT && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:border-slate-400 transition"
            >
              {expanded ? 'Comprimir ▲' : 'Expandir ▼'}
            </button>
          )}
        </div>
      </div>
      <pre className="overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-300 border border-slate-700 max-h-48 whitespace-pre-wrap">
        {display}
      </pre>
    </div>
  );
}

function ToolCallCard({ call, index }: { call: AgentToolCall; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-slate-700 bg-slate-900 p-2 text-xs">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-mono font-semibold text-blue-300">
          {index + 1}. {call.tool}
        </span>
        <span className="text-slate-500">⏱ {call.durationMs}ms {open ? '▲' : '▶'}</span>
      </div>
      {open && (
        <div className="mt-2 grid gap-1">
          <div>
            <span className="text-slate-500">Args:</span>
            <pre className="mt-0.5 overflow-auto rounded bg-black/30 p-1 text-green-300 max-h-24">
              {JSON.stringify(call.args, null, 2)}
            </pre>
          </div>
          <div>
            <span className="text-slate-500">Result:</span>
            <pre className="mt-0.5 overflow-auto rounded bg-black/30 p-1 text-green-300 max-h-24">
              {JSON.stringify(call.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ExchangeCard({ exchange, index }: { exchange: AgentLlmExchange; index: number }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded border border-slate-600 p-3 bg-slate-800/50">
      <div
        className="flex cursor-pointer items-center justify-between mb-2"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-medium text-white">
          Iteración LLM {index + 1}
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>⏱ {exchange.durationMs}ms</span>
          <span>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3">
          <ExpandableText text={exchange.systemPrompt} label="System prompt" />
          <ExpandableText text={exchange.userPrompt} label="Mensaje de usuario" />

          {exchange.toolCalls.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-300">
                Tool calls en esta iteración ({exchange.toolCalls.length})
              </p>
              <div className="flex flex-col gap-1">
                {exchange.toolCalls.map((tc, i) => (
                  <ToolCallCard key={i} call={tc} index={i} />
                ))}
              </div>
            </div>
          )}

          <ExpandableText text={exchange.rawResponse} label="Respuesta cruda del LLM" />
        </div>
      )}
    </div>
  );
}

function memoryDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before || !after) return [];
  const diffs: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    const prev = JSON.stringify(before[key]);
    const curr = JSON.stringify(after[key]);
    if (prev === undefined && curr !== undefined) {
      diffs.push(`+ ${key}: ${curr}`);
    } else if (prev !== undefined && curr === undefined) {
      diffs.push(`- ${key}: eliminado`);
    } else if (prev !== curr) {
      diffs.push(`~ ${key}: ${prev} → ${curr}`);
    }
  }
  return diffs;
}

export function TrainingAgentInteractionLog({
  trace,
  memoriaInicial,
  memoriaFinal,
  turno,
}: TrainingAgentInteractionLogProps) {
  const [open, setOpen] = useState(false);
  const diffLines = memoryDiff(memoriaInicial, memoriaFinal);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-200 transition-colors"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>Interacción del agente (turno {turno}, {trace.type})</span>
      </button>

      {open && (
        <div className="mt-2 rounded border border-indigo-700/50 bg-slate-800 p-3">
          {/* Memoria inicial */}
          {memoriaInicial && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-slate-400">Memoria al inicio del turno</p>
              <pre className="overflow-auto rounded bg-slate-900 p-2 text-xs text-cyan-300 border border-slate-700 max-h-32">
                {JSON.stringify(memoriaInicial, null, 2)}
              </pre>
            </div>
          )}

          {/* LLM exchanges */}
          <div className="flex flex-col gap-2 mb-3">
            {trace.exchanges.map((ex, i) => (
              <ExchangeCard key={i} exchange={ex} index={i} />
            ))}
          </div>

          {/* Parsed action */}
          <div className="mb-3 rounded border px-3 py-2 text-sm">
            {trace.parsedAction ? (
              <span className="text-green-400">
                ✅ Acción parseada: <span className="font-mono">{trace.parsedAction.action.type}</span>
                {trace.parsedAction.action.type === 'suggestion' || trace.parsedAction.action.type === 'accusation'
                  ? ` (${(trace.parsedAction.action as { suspect: string; weapon: string; room: string }).suspect} · ${(trace.parsedAction.action as { suspect: string; weapon: string; room: string }).weapon} · ${(trace.parsedAction.action as { suspect: string; weapon: string; room: string }).room})`
                  : ''}
              </span>
            ) : (
              <span className="text-red-400">
                ❌ Error de parsing: {trace.parseError}
              </span>
            )}
          </div>

          {/* Memoria final */}
          {memoriaFinal && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-slate-400">Memoria al final del turno</p>
              <pre className="overflow-auto rounded bg-slate-900 p-2 text-xs text-cyan-300 border border-slate-700 max-h-32">
                {JSON.stringify(memoriaFinal, null, 2)}
              </pre>
            </div>
          )}

          {/* Memory diff */}
          <div className="text-xs text-slate-400">
            <p className="mb-1 font-medium">Diff de memoria</p>
            {diffLines.length === 0 ? (
              <p className="text-slate-500 italic">Sin cambios en memoria</p>
            ) : (
              <pre className="rounded bg-slate-900 p-2 text-green-300 border border-slate-700">
                {diffLines.join('\n')}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
