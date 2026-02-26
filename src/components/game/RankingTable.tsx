import { formatPuntos, formatPosicion } from '@/lib/utils/formatting';
import type { RankingEntry } from '@/types/domain';

interface RankingTableProps {
  entries: RankingEntry[];
  highlightEquipoId?: string;
}

export function RankingTable({ entries, highlightEquipoId }: RankingTableProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1a1a2e' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            <th className="px-4 py-3 text-left font-medium" style={{ color: '#64748b' }}>#</th>
            <th className="px-4 py-3 text-left font-medium" style={{ color: '#64748b' }}>Equipo</th>
            <th className="px-4 py-3 text-right font-medium" style={{ color: '#64748b' }}>Puntos</th>
            <th className="px-4 py-3 text-right font-medium" style={{ color: '#64748b' }}>Partidas</th>
            <th className="px-4 py-3 text-right font-medium" style={{ color: '#64748b' }}>Aciertos</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => {
            const isHighlighted = entry.equipoId === highlightEquipoId;
            const isFirst = idx === 0;
            return (
              <tr
                key={entry.equipoId}
                style={{
                  borderBottom: '1px solid #1e293b',
                  background: isHighlighted
                    ? 'rgba(245, 158, 11, 0.1)'
                    : isFirst
                    ? 'rgba(245, 158, 11, 0.05)'
                    : undefined,
                }}
              >
                <td
                  className="px-4 py-3 font-bold"
                  style={{ color: isFirst ? '#f59e0b' : '#64748b' }}
                >
                  {formatPosicion(entry.posicion)}
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: isHighlighted ? '#f59e0b' : '#f1f5f9' }}>
                  {entry.equipoNombre}
                  {isHighlighted && (
                    <span className="text-xs ml-2" style={{ color: '#64748b' }}>
                      (tú)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: '#f59e0b' }}>
                  {formatPuntos(entry.puntos)}
                </td>
                <td className="px-4 py-3 text-right" style={{ color: '#94a3b8' }}>
                  {entry.partidasJugadas}
                </td>
                <td className="px-4 py-3 text-right" style={{ color: '#94a3b8' }}>
                  {entry.aciertos}
                </td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#64748b' }}>
                No hay datos de ranking aún.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
