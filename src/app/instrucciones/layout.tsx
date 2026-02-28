import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cómo construir tu agente — Clue Arena',
  description:
    'Guía técnica completa para construir un agente IA que juegue al Cluedo en la plataforma Clue Arena: contrato MCP, herramientas, esquemas y plantillas de inicio rápido.',
  robots: { index: false, follow: false },
};

export default function InstruccionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout — no AppShell, no sidebar, no auth requirement.
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {children}
    </div>
  );
}
