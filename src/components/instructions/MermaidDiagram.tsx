'use client';

import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

let mermaidInitialized = false;

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const id = useId().replace(/:/g, '-');
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      if (!containerRef.current) return;

      try {
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            themeVariables: {
              background: '#020617',
              primaryColor: '#0f172a',
              primaryTextColor: '#e2e8f0',
              primaryBorderColor: '#334155',
              lineColor: '#38bdf8',
              secondaryColor: '#082f49',
              tertiaryColor: '#111827',
              actorBkg: '#082f49',
              actorBorder: '#38bdf8',
              actorTextColor: '#e0f2fe',
              signalColor: '#f8fafc',
              signalTextColor: '#e2e8f0',
              labelBoxBkgColor: '#0f172a',
              labelBoxBorderColor: '#334155',
              labelTextColor: '#cbd5e1',
              noteBkgColor: '#172554',
              noteBorderColor: '#60a5fa',
              noteTextColor: '#dbeafe',
            },
          });
          mermaidInitialized = true;
        }

        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo renderizar el diagrama.');
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
        Error al renderizar el diagrama: {error}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[24px] border border-slate-800 bg-slate-950/70 p-4">
      <div ref={containerRef} className="min-w-[720px]" />
    </div>
  );
}
