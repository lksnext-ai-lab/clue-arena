'use client';

import { useEffect, useState } from 'react';

const TOC_SECTIONS = [
  { id: 'intro',        label: 'Introducción',             num: '1' },
  { id: 'como-funciona',label: 'Cómo funciona un agente', num: '2' },
  { id: 'contrato-mcp', label: 'Contrato MCP',            num: '3' },
  { id: 'herramientas', label: 'Herramientas disponibles', num: '4' },
  { id: 'respuesta',    label: 'Respuesta del agente',     num: '5' },
  { id: 'elementos',    label: 'Elementos del juego',      num: '6' },
  { id: 'puntuacion',   label: 'Sistema de puntuación',   num: '7' },
  { id: 'quickstart',   label: 'Inicio rápido',            num: '8' },
  { id: 'registro',     label: 'Registro del agente',      num: '9' },
  { id: 'faq',          label: 'FAQ y errores comunes',    num: '10' },
];

export function TableOfContents() {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible section
          const topmost = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
          setActiveId(topmost.target.id);
        }
      },
      { rootMargin: '-10% 0% -80% 0%', threshold: 0 },
    );

    TOC_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Tabla de contenidos" className="space-y-1">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Contenido
      </p>
      {TOC_SECTIONS.map(({ id, label, num }) => (
        <a
          key={id}
          href={`#${id}`}
          className={[
            'flex items-baseline gap-2 rounded px-2 py-1.5 text-sm transition-colors',
            activeId === id
              ? 'bg-slate-800 text-cyan-400 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
          ].join(' ')}
        >
          <span className="font-mono text-xs text-slate-600 shrink-0">§{num}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}
