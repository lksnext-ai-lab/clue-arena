import Link from 'next/link';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LastGameEquipoEntry {
  equipoId: string;
  equipoNombre: string;
  puntos: number;
  eliminado: boolean;
}

export interface LastGameData {
  id: string;
  nombre: string;
  estado: 'pendiente' | 'en_curso' | 'finalizada';
  turnoActual: number;
  maxTurnos: number | null;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  equipos: LastGameEquipoEntry[];
}

interface LastGameCardProps {
  game: LastGameData | null;
  miEquipoId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDurationMin(startMs: number | null, endMs: number | null): number | null {
  if (!startMs) return null;
  const end = endMs ?? Date.now();
  return Math.round((end - startMs) / 60_000);
}

const ESTADO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pendiente:  { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', label: 'Pendiente' },
  en_curso:   { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', label: 'En Curso' },
  finalizada: { bg: 'rgba(148,163,184,0.1)',  text: '#64748b', label: 'Finalizada' },
};

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TeamRow({
  entry,
  position,
  isWinner,
  isOwn,
}: {
  entry: LastGameEquipoEntry;
  position: number;
  isWinner: boolean;
  isOwn: boolean;
}) {
  const medal = MEDAL[position];
  const highlight = isOwn ? '1px solid rgba(34,211,238,0.3)' : '1px solid rgba(255,255,255,0.05)';
  const bg = isWinner
    ? 'rgba(250,204,21,0.06)'
    : isOwn
    ? 'rgba(34,211,238,0.05)'
    : 'rgba(255,255,255,0.02)';

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 10,
        background: bg,
        border: highlight,
        opacity: entry.eliminado ? 0.5 : 1,
      }}
    >
      {/* Position */}
      <span style={{ fontSize: 15, width: 24, textAlign: 'center', flexShrink: 0 }}>
        {medal ?? <span style={{ fontSize: 11, color: '#475569' }}>#{position}</span>}
      </span>

      {/* Name */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: isWinner ? 700 : 500,
          color: isOwn ? '#22d3ee' : isWinner ? '#fde68a' : '#cbd5e1',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.equipoNombre}
        {isOwn && (
          <span style={{ marginLeft: 6, fontSize: 10, color: '#67e8f9', fontWeight: 400 }}>(tú)</span>
        )}
      </span>

      {/* Eliminated badge */}
      {entry.eliminado && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 8,
            background: 'rgba(236,72,153,0.15)',
            color: '#f472b6',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          Eliminado
        </span>
      )}

      {/* Points */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: isWinner ? '#fde68a' : '#94a3b8',
          flexShrink: 0,
        }}
      >
        {entry.puntos.toFixed(1)} <span style={{ fontSize: 10, fontWeight: 400 }}>pts</span>
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LastGameCard({ game, miEquipoId }: LastGameCardProps) {
  const t = useTranslations('dashboard');

  if (!game) {
    return (
      <section
        style={{
          background: 'linear-gradient(160deg,#1e293b 0%,#0f172a 100%)',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <SectionHeader title={t('ultimaPartidaTitulo')} />
        <p style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
          {t('ultimaPartidaSinDatos')}
        </p>
      </section>
    );
  }

  const sortedEquipos = [...game.equipos].sort((a, b) => b.puntos - a.puntos);
  const winner = game.estado === 'finalizada' ? sortedEquipos[0] ?? null : null;
  const durationMin = getDurationMin(game.startedAtMs, game.finishedAtMs);
  const estadoStyle = ESTADO_COLORS[game.estado] ?? ESTADO_COLORS.pendiente;

  // Turn progress
  const turnPct =
    game.maxTurnos && game.maxTurnos > 0
      ? Math.min(100, Math.round((game.turnoActual / game.maxTurnos) * 100))
      : null;

  return (
    <section
      style={{
        background: 'linear-gradient(160deg,#1e293b 0%,#0f172a 100%)',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: 24,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <SectionHeader title={t('ultimaPartidaTitulo')} />

        {/* Status badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: 20,
            background: estadoStyle.bg,
            color: estadoStyle.text,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {estadoStyle.label}
        </span>

        {/* Spacer + link */}
        <div style={{ flex: 1 }} />
        <Link
          href={`/partidas/${game.id}`}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#22d3ee',
            textDecoration: 'none',
            padding: '4px 12px',
            border: '1px solid rgba(34,211,238,0.25)',
            borderRadius: 20,
            background: 'rgba(34,211,238,0.07)',
          }}
        >
          {t('ultimaPartidaVer')} →
        </Link>
      </div>

      {/* Game name */}
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 15,
          fontWeight: 700,
          color: '#e2e8f0',
        }}
      >
        {game.nombre}
      </p>

      {/* Metrics strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <MetricPill
          icon="🎲"
          label={
            game.maxTurnos
              ? `Turno ${game.turnoActual} / ${game.maxTurnos}`
              : game.turnoActual > 0
              ? `Turno ${game.turnoActual}`
              : 'Sin iniciar'
          }
        />
        {durationMin !== null && (
          <MetricPill
            icon="⏱"
            label={
              game.estado === 'en_curso'
                ? `${durationMin} min en curso`
                : `${durationMin} min`
            }
          />
        )}
        <MetricPill icon="👥" label={`${game.equipos.length} equipos`} />
        {winner && (
          <MetricPill icon="🏆" label={`Ganador: ${winner.equipoNombre}`} highlight />
        )}
      </div>

      {/* Turn progress bar */}
      {turnPct !== null && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 5,
              fontSize: 10,
              color: '#475569',
            }}
          >
            <span>Progreso de turnos</span>
            <span>{turnPct}%</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${turnPct}%`,
                borderRadius: 6,
                background:
                  game.estado === 'finalizada'
                    ? 'linear-gradient(90deg,#64748b,#475569)'
                    : 'linear-gradient(90deg,#06b6d4,#22d3ee)',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Teams scoreboard */}
      {sortedEquipos.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {sortedEquipos.map((entry, idx) => (
            <TeamRow
              key={entry.equipoId}
              entry={entry}
              position={idx + 1}
              isWinner={winner?.equipoId === entry.equipoId}
              isOwn={entry.equipoId === miEquipoId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tiny shared helpers
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
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
      {title}
    </h2>
  );
}

function MetricPill({
  icon,
  label,
  highlight = false,
}: {
  icon: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: highlight ? 700 : 500,
        padding: '4px 10px',
        borderRadius: 20,
        background: highlight ? 'rgba(250,204,21,0.08)' : 'rgba(255,255,255,0.05)',
        border: highlight ? '1px solid rgba(250,204,21,0.2)' : '1px solid rgba(255,255,255,0.07)',
        color: highlight ? '#fde68a' : '#94a3b8',
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      {label}
    </span>
  );
}
