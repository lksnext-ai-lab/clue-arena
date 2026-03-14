const SCORING_EVENTS = [
  {
    id: 'EVT_WIN',
    description: 'Acusación correcta que resuelve el sobre',
    points: '+1 000',
    color: 'text-emerald-400',
  },
  {
    id: 'EVT_WIN_EFFICIENCY',
    description: 'Bonificación por eficiencia (solo con EVT_WIN): max(0, 500 − (T − 2) × 25)',
    points: '+0 a +500',
    color: 'text-emerald-400',
  },
  {
    id: 'EVT_SURVIVE',
    description: 'Llegar al final sin ser eliminado (cuando otro equipo gana)',
    points: '+200',
    color: 'text-emerald-400',
  },
  {
    id: 'EVT_REFUTATION',
    description: 'Refutar con éxito la sugerencia de otro equipo (mostrar carta válida)',
    points: '+5',
    color: 'text-emerald-400',
  },
  {
    id: 'EVT_FALSE_CANNOT_REFUTE',
    description: 'Declarar cannot_refute o mostrar carta inválida cuando el coordinador sabe que el equipo puede refutar',
    points: '−20',
    color: 'text-red-400',
  },
  {
    id: 'EVT_SUGGESTION',
    description: 'Sugerencia lógicamente válida (nueva combinación, cartas existentes) — cap 5×/partida',
    points: '+10',
    color: 'text-cyan-400',
  },
  {
    id: 'EVT_WRONG_ACCUSATION',
    description: 'Acusación incorrecta → elimina al equipo de la partida',
    points: '−150',
    color: 'text-red-400',
  },
  {
    id: 'EVT_INVALID_CARD',
    description: 'Sugerencia/acusación con nombre de elemento incorrecto (mayúscula, tilde, etc.)',
    points: '−30',
    color: 'text-red-400',
  },
  {
    id: 'EVT_INVALID_FORMAT',
    description: 'Respuesta del agente con formato JSON incorrecto o campo action inválido para el modo',
    points: '−25',
    color: 'text-red-400',
  },
  {
    id: 'EVT_REDUNDANT_SUGGESTION',
    description: 'Sugerencia con la misma tripla (sospechoso + arma + escenario) ya usada en la partida',
    points: '−20',
    color: 'text-amber-400',
  },
  {
    id: 'EVT_TIMEOUT',
    description: 'El agente no responde dentro del tiempo límite del turno',
    points: '−20',
    color: 'text-amber-400',
  },
  {
    id: 'EVT_PASS',
    description: 'El agente pasa su turno sin sugerir ni acusar',
    points: '−5',
    color: 'text-amber-400',
  },
] as const;

export function ScoringTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Tabla de eventos puntuables de la competición</caption>
        <thead>
          <tr>
            <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">
              Evento
            </th>
            <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">
              Cuándo ocurre
            </th>
            <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-right whitespace-nowrap">
              Puntos
            </th>
          </tr>
        </thead>
        <tbody>
          {SCORING_EVENTS.map((e) => (
            <tr key={e.id} className="hover:bg-slate-800/30">
              <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-xs text-cyan-300 whitespace-nowrap">
                {e.id}
              </td>
              <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">
                {e.description}
              </td>
              <td
                className={[
                  'px-4 py-2.5 border-b border-slate-800 text-right font-mono font-bold whitespace-nowrap',
                  e.color,
                ].join(' ')}
              >
                {e.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
