import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinishedGameEquipo {
  equipoId: string;
  equipoNombre: string;
  puntos: number;
  eliminado: boolean;
}

export interface FinishedGameEntry {
  id: string;
  nombre: string;
  finishedAtMs: number | null;
  startedAtMs: number | null;
  turnoActual: number;
  maxTurnos: number | null;
  equipos: FinishedGameEquipo[];
}

interface RecentFinishedGamesProps {
  games: FinishedGameEntry[];
  miEquipoId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function durationMin(startMs: number | null, endMs: number | null): number | null {
  if (!startMs || !endMs) return null;
  return Math.round((endMs - startMs) / 60_000);
}

// ---------------------------------------------------------------------------
// Sub-component: single finished game card
// ---------------------------------------------------------------------------

interface GameCardProps {
  game: FinishedGameEntry;
  miEquipoId: string | null;
  labels: {
    verPartida: string;
    turnos: string;
    duracion: string;
    min: string;
    ganador: string;
  };
}

function GameCard({ game, miEquipoId, labels }: GameCardProps) {
  const sorted = [...game.equipos].sort((a, b) => b.puntos - a.puntos);
  const winner = sorted[0];
  const dur = durationMin(game.startedAtMs, game.finishedAtMs);

  return (
    <li
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {game.nombre}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {game.finishedAtMs && (
              <span style={{ fontSize: 11, color: '#475569' }}>{formatDate(game.finishedAtMs)}</span>
            )}
            <span style={{ fontSize: 11, color: '#475569' }}>
              {labels.turnos}: {game.turnoActual}
              {game.maxTurnos ? `/${game.maxTurnos}` : ''}
            </span>
            {dur !== null && (
              <span style={{ fontSize: 11, color: '#475569' }}>
                {labels.duracion}: {dur} {labels.min}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/partidas/${game.id}`}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#22d3ee',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(34,211,238,0.25)',
            flexShrink: 0,
          }}
        >
          {labels.verPartida}
        </Link>
      </div>

      {/* Winner highlight */}
      {winner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(250,204,21,0.07)',
            border: '1px solid rgba(250,204,21,0.15)',
            borderRadius: 8,
            padding: '6px 12px',
          }}
        >
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={{ fontSize: 12, color: '#fde68a', fontWeight: 600 }}>
            {labels.ganador}:
          </span>
          <span
            style={{
              fontSize: 12,
              color: winner.equipoId === miEquipoId ? '#22d3ee' : '#fef3c7',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {winner.equipoNombre}
          </span>
          <span style={{ fontSize: 12, color: '#92400e', marginLeft: 'auto' }}>
            {winner.puntos.toFixed(1)} pts
          </span>
        </div>
      )}

      {/* Scoreboard */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map((eq, idx) => {
          const pos = idx + 1;
          const isOwn = eq.equipoId === miEquipoId;
          return (
            <li
              key={eq.equipoId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                borderRadius: 8,
                background: isOwn ? 'rgba(34,211,238,0.05)' : 'transparent',
                border: isOwn ? '1px solid rgba(34,211,238,0.15)' : '1px solid transparent',
                opacity: eq.eliminado ? 0.5 : 1,
              }}
            >
              <span style={{ width: 20, textAlign: 'center', fontSize: 13, flexShrink: 0 }}>
                {MEDAL[pos] ?? <span style={{ fontSize: 10, color: '#475569' }}>#{pos}</span>}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: isOwn ? '#22d3ee' : pos === 1 ? '#fde68a' : '#94a3b8',
                  fontWeight: isOwn || pos === 1 ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {eq.equipoNombre}
              </span>
              <span style={{ fontSize: 12, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                {eq.puntos.toFixed(1)} pts
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component (Server Component)
// ---------------------------------------------------------------------------

export async function RecentFinishedGames({ games, miEquipoId }: RecentFinishedGamesProps) {
  const t = await getTranslations('dashboard');

  const labels = {
    verPartida: t('ultimaPartidaVer'),
    turnos: t('rfgTurnos'),
    duracion: t('rfgDuracion'),
    min: t('rfgMin'),
    ganador: t('rfgGanador'),
  };

  return (
    <section
      aria-label={t('rfgTitulo')}
      style={{
        background: 'linear-gradient(160deg,#1e293b 0%,#0f172a 100%)',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            color: '#22d3ee',
            textTransform: 'uppercase',
          }}
        >
          {t('rfgTitulo')}
        </h2>
        <span style={{ fontSize: 10, color: '#475569' }}>
          {t('rfgUltimas', { n: games.length })}
        </span>
      </div>

      {games.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#475569', textAlign: 'center', padding: '20px 0' }}>
          {t('rfgSinPartidas')}
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              miEquipoId={miEquipoId}
              labels={labels}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
