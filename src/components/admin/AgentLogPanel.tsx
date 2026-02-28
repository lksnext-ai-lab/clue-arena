'use client';

/**
 * F012 — AgentLogPanel
 *
 * Real-time log viewer for the admin partida detail page.
 * Connects to GET /api/admin/log/stream?gameId={id} via Server-Sent Events
 * and renders structured interaction log entries as they arrive.
 *
 * Features:
 *  - Live indicator (● LIVE / ○ disconnected)
 *  - Optional filter by teamId
 *  - Color coding: errors (red), timeouts (orange), warnings (yellow), ok (normal)
 *  - Expandable rows to see full JSON
 *  - Auto-scroll to bottom (toggleable)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface LogEntry {
  time?: number;
  event?: string;
  invocacionId?: string;
  gameId?: string;
  teamId?: string;
  turnoId?: string;
  estado?: string;
  herramienta?: string;
  durationMs?: number;
  secuencia?: number;
  agentBackend?: string;
  tipo?: string;
  errorMessage?: string;
  responseValid?: boolean | null;
  actionType?: string;
  [key: string]: unknown;
}

interface AgentLogPanelProps {
  gameId: string;
}

const MAX_ENTRIES = 500;

function formatTime(ts?: number): string {
  if (!ts) return '--:--:--.---';
  const d = new Date(ts);
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0') +
    ':' +
    String(d.getSeconds()).padStart(2, '0') +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

function getRowColor(entry: LogEntry): string {
  if (entry.estado === 'error' || entry.event === 'mcp_tool_limit_exceeded') return '#ef444433';
  if (entry.estado === 'timeout') return '#f97316' + '22';
  if (entry.responseValid === false) return '#ef444422';
  return 'transparent';
}

function getRowBorder(entry: LogEntry): string {
  if (entry.estado === 'error' || entry.event === 'mcp_tool_limit_exceeded') return '#ef4444';
  if (entry.estado === 'timeout') return '#f97316';
  if (entry.responseValid === false) return '#f59e0b';
  return 'transparent';
}

function summarize(entry: LogEntry): string {
  const parts: string[] = [];

  switch (entry.event) {
    case 'agent_invocation_start':
      parts.push(`▶ ${entry.tipo ?? '?'}`, entry.agentBackend ?? '');
      break;
    case 'agent_invocation_complete':
      parts.push(
        `■ ${entry.estado ?? '?'}`,
        entry.durationMs != null ? `${entry.durationMs}ms` : '',
        entry.actionType ? `→ ${entry.actionType}` : '',
      );
      break;
    case 'agent_response_validation':
      parts.push(entry.responseValid ? '✓ válida' : '✗ inválida', entry.actionType ?? '');
      break;
    case 'mcp_tool_call':
      parts.push(
        `[${entry.secuencia ?? '?'}]`,
        entry.herramienta ?? '?',
        entry.estado ?? '?',
        entry.durationMs != null ? `${entry.durationMs}ms` : '',
      );
      break;
    case 'mcp_tool_limit_exceeded':
      parts.push(`⚠ limit exceeded`, entry.herramienta ?? '', `seq=${entry.secuencia ?? '?'}`);
      break;
    default:
      parts.push(entry.event ?? 'unknown');
  }

  return parts.filter(Boolean).join('  ');
}

export function AgentLogPanel({ gameId }: AgentLogPanelProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const url = `/api/admin/log/stream?gameId=${encodeURIComponent(gameId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 5 s
      setTimeout(connect, 5000);
    };
    es.onmessage = (evt) => {
      try {
        const entry = JSON.parse(evt.data as string) as LogEntry;
        setEntries((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
        });
      } catch {
        // Ignore malformed lines
      }
    };
  }, [gameId]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  const visible = teamFilter
    ? entries.filter((e) => e.teamId?.includes(teamFilter))
    : entries;

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <section>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>
          📋 Log de agentes
        </h2>
        {/* Live badge */}
        <span
          className="text-xs px-2 py-0.5 rounded-full font-mono"
          style={{
            background: connected ? '#22c55e22' : '#64748b22',
            color: connected ? '#22c55e' : '#64748b',
            border: `1px solid ${connected ? '#22c55e44' : '#64748b44'}`,
          }}
        >
          {connected ? '● LIVE' : '○ reconectando…'}
        </span>
        {/* Team filter */}
        <input
          type="text"
          placeholder="filtrar por teamId…"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="text-xs px-2 py-1 rounded font-mono"
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            color: '#94a3b8',
            outline: 'none',
            width: '180px',
          }}
        />
        {/* Auto-scroll toggle */}
        <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: '#64748b' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="cursor-pointer"
          />
          auto-scroll
        </label>
        {/* Clear button */}
        <button
          onClick={() => setEntries([])}
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
        >
          limpiar
        </button>
      </div>

      {/* ── Log table ── */}
      <div
        className="rounded-xl overflow-auto font-mono text-xs"
        style={{
          background: '#0a0a1a',
          border: '1px solid #1e293b',
          maxHeight: '360px',
        }}
      >
        {visible.length === 0 ? (
          <p className="p-4 text-center" style={{ color: '#334155' }}>
            Sin entradas todavía…
          </p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {visible.map((entry, idx) => {
                const bg = getRowColor(entry);
                const borderLeft = getRowBorder(entry);
                const isExpanded = expanded.has(idx);

                return (
                  <>
                    <tr
                      key={idx}
                      onClick={() => toggleExpand(idx)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        background: bg,
                        borderLeft: `3px solid ${borderLeft}`,
                      }}
                    >
                      {/* Timestamp */}
                      <td
                        className="px-2 py-1 whitespace-nowrap select-none"
                        style={{ color: '#475569', minWidth: '100px' }}
                      >
                        {formatTime(entry.time)}
                      </td>
                      {/* Team */}
                      <td
                        className="px-2 py-1 whitespace-nowrap"
                        style={{ color: '#7c3aed', minWidth: '80px' }}
                      >
                        {entry.teamId ?? '—'}
                      </td>
                      {/* Event */}
                      <td
                        className="px-2 py-1 whitespace-nowrap"
                        style={{ color: '#38bdf8', minWidth: '200px' }}
                      >
                        {entry.event ?? 'unknown'}
                      </td>
                      {/* Summary */}
                      <td className="px-2 py-1 w-full" style={{ color: '#cbd5e1' }}>
                        {summarize(entry)}
                      </td>
                    </tr>

                    {/* Expanded JSON row */}
                    {isExpanded && (
                      <tr key={`${idx}-detail`} style={{ background: '#0d0d1e' }}>
                        <td
                          colSpan={4}
                          className="px-4 py-3"
                          style={{ borderLeft: `3px solid ${borderLeft}` }}
                        >
                          <pre
                            className="text-xs overflow-auto rounded p-2"
                            style={{
                              background: '#070712',
                              color: '#94a3b8',
                              maxHeight: '200px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                            }}
                          >
                            {JSON.stringify(entry, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              <tr ref={bottomRef as React.RefObject<HTMLTableRowElement>} />
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-1 text-xs" style={{ color: '#334155' }}>
        {visible.length} entradas
        {visible.length < entries.length && ` (${entries.length - visible.length} filtradas)`}
        {' · '}máx. {MAX_ENTRIES} · haz clic en una fila para expandir
      </p>
    </section>
  );
}
