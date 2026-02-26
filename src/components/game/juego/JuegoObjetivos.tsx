import { Brain, Cpu, Users, BarChart3 } from 'lucide-react';

interface ObjetivoItem {
  id: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  titulo: string;
  descripcion: string;
}

interface KpiItem {
  label: string;
  valor: string;
}

const OBJETIVO_ITEMS: ObjetivoItem[] = [
  {
    id: 'OBJ-01',
    Icon: Brain,
    titulo: 'Aprendizaje práctico de IA agencial',
    descripcion:
      'Los empleados construyen y compiten con agentes IA reales, no solo leen sobre ellos. La experiencia directa acelera la comprensión.',
  },
  {
    id: 'OBJ-02',
    Icon: Cpu,
    titulo: 'Adopción de herramientas IA corporativas',
    descripcion:
      'Familiaridad directa con MattinAI y el Model Context Protocol (MCP) como estándar de integración para agentes IA.',
  },
  {
    id: 'OBJ-03',
    Icon: Users,
    titulo: 'Cultura de innovación y competición interna',
    descripcion:
      'El challenge crea un espacio seguro para experimentar, fallar y aprender en equipo con una dinámica motivadora.',
  },
  {
    id: 'OBJ-04',
    Icon: BarChart3,
    titulo: 'Medición de comprensión IA post-evento',
    descripcion:
      'Meta: ≥ 4/5 en encuesta "¿Entiendo mejor qué es un agente IA?". Evidencia cuantitativa del impacto formativo.',
  },
];

const KPI_ITEMS: KpiItem[] = [
  { label: 'Equipos que completan ≥ 1 partida', valor: '≥ 80%' },
  { label: 'Partidas sin error técnico', valor: '≥ 95%' },
  { label: 'Puntuación media encuesta post-evento', valor: '≥ 4 / 5' },
  { label: 'NPS del evento', valor: '≥ 30' },
];

export function JuegoObjetivos() {
  return (
    <section aria-labelledby="objetivos-heading">
      <h2
        id="objetivos-heading"
        className="text-xs font-semibold tracking-widest uppercase text-cyan-400 mb-5"
      >
        Objetivos del evento
      </h2>

      {/* Objetivo cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {OBJETIVO_ITEMS.map(({ id, Icon, titulo, descripcion }) => (
          <div
            key={id}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} className="text-cyan-400 shrink-0" />
              <span className="text-xs text-slate-500 font-mono">{id}</span>
            </div>
            <p className="text-sm font-semibold text-white mt-2 mb-1">{titulo}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{descripcion}</p>
          </div>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {KPI_ITEMS.map(({ label, valor }) => (
          <div
            key={label}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
          >
            <span className="text-xs text-slate-400 leading-tight">{label}</span>
            <span className="text-sm font-bold text-cyan-400 shrink-0">{valor}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
