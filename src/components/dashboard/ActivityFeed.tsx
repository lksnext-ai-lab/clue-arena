'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useInterval } from '@/lib/utils/useInterval';
import { useTranslations } from 'next-intl';
import { ActivityItem, type ActivityEvent } from './ActivityItem';

interface ActivityResponse {
  events: ActivityEvent[];
}

interface ActivityFeedProps {
  initialEvents: ActivityEvent[];
  miEquipoId: string | null;
}

export function ActivityFeed({ initialEvents, miEquipoId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const t = useTranslations('dashboard');

  useInterval(() => {
    apiFetch<ActivityResponse>('/games/activity?limit=10')
      .then((data) => setEvents(data.events))
      .catch(() => {});
  }, 10_000);

  return (
    <section
      aria-label="Actividad reciente"
      style={{
        background: 'linear-gradient(160deg,#1e293b 0%,#0f172a 100%)',
        border: '1px solid #334155', borderRadius: 16, padding: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#22d3ee', textTransform: 'uppercase' }}>
          {t('actividadTitulo')}
        </h2>
        <span style={{ fontSize: 10, color: '#475569' }}>{t('ultimosEventos', { n: events.length })}</span>
      </div>

      {events.length === 0 ? (
        <EmptyFeed />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map((event) => (
            <ActivityItem key={event.id} event={event} miEquipoId={miEquipoId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyFeed() {
  const t = useTranslations('dashboard');
  // Show placeholder items when there's no activity
  const examples = [
    { icon: '✂️', color: '#f43f5e', text: 'Equipo Delta descartó \'Cable de Red Cat 6\'.', time: 'Hace 5 min', typeLabel: 'descarte' },
    { icon: '🔍', color: '#a78bfa', text: 'Equipo Sigma interrogó a \'Dra. Peacock\' en \'Recursos Humanos\'.', time: 'Hace 12 min', typeLabel: 'interrogatorio' },
    { icon: '💡', color: '#22d3ee', text: 'Equipo Alpha encontró una pista en \'El Open Space\'.', time: 'Hace 20 min', typeLabel: 'pista' },
  ];

  return (
    <div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.4 }}>
        {examples.map((ex, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{
              fontSize: 14, width: 24, height: 24, borderRadius: 6,
              background: `${ex.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{ex.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>{ex.text}</p>
              <span style={{ fontSize: 10, color: '#475569' }}>{ex.time}</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 9, background: `${ex.color}20`, color: ex.color, textTransform: 'uppercase', flexShrink: 0 }}>
              {ex.typeLabel}
            </span>
          </li>
        ))}
      </ul>
      <p style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginTop: 10 }}>
        {t('sinActividad')}
      </p>
    </div>
  );
}
