'use client';

import { useFormatter, useTranslations } from 'next-intl';

export interface ActivityEvent {
  id: string;
  timestampMs: number;
  tipo: 'descarte' | 'interrogatorio' | 'pista' | 'acusacion' | 'sugerencia';
  actorNombre: string;
  actorEquipoId: string;
  descripcion: string;
}

const TYPE_COLOR: Record<ActivityEvent['tipo'], string> = {
  descarte:      '#f43f5e', // rose
  interrogatorio:'#a78bfa', // violet
  pista:         '#22d3ee', // cyan
  acusacion:     '#fb923c', // orange
  sugerencia:    '#34d399', // emerald
};

const TYPE_ICON: Record<ActivityEvent['tipo'], string> = {
  descarte:      '✂️',
  interrogatorio:'🔍',
  pista:         '💡',
  acusacion:     '⚖️',
  sugerencia:    '💬',
};

interface ActivityItemProps {
  event: ActivityEvent;
  miEquipoId: string | null;
}

export function ActivityItem({ event, miEquipoId }: ActivityItemProps) {
  const isOwn = event.actorEquipoId === miEquipoId;
  const typeColor = TYPE_COLOR[event.tipo];
  const icon = TYPE_ICON[event.tipo];
  const format = useFormatter();
  const t = useTranslations('dashboard');

  return (
    <li style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 10,
      background: isOwn ? 'rgba(34,211,238,0.06)' : 'rgba(255,255,255,0.03)',
      border: isOwn ? '1px solid rgba(34,211,238,0.18)' : '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Type icon */}
      <span style={{
        fontSize: 14, flexShrink: 0, marginTop: 1,
        width: 24, height: 24, borderRadius: 6,
        background: `${typeColor}1a`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>
          {isOwn ? (
            <>
              <strong style={{ color: '#22d3ee', fontWeight: 700 }}>
                {t('tu')} ({event.actorNombre})
              </strong>{' '}
              {event.descripcion.replace(event.actorNombre, '').trim()}
            </>
          ) : (
            event.descripcion
          )}
        </p>
        <span style={{ fontSize: 10, color: '#475569', marginTop: 2, display: 'block' }}>
          {format.relativeTime(new Date(event.timestampMs), new Date())}
        </span>
      </div>

      {/* Type badge */}
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0,
        padding: '2px 7px', borderRadius: 9,
        background: `${typeColor}20`, color: typeColor,
        textTransform: 'uppercase',
      }}>
        {event.tipo}
      </span>
    </li>
  );
}
