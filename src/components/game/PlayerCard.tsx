import { formatPuntos } from '@/lib/utils/formatting';

interface PlayerCardProps {
  equipoId: string;
  nombre: string;
  puntos: number;
  eliminado: boolean;
  esPropio?: boolean;
}

export function PlayerCard({ nombre, puntos, eliminado, esPropio }: PlayerCardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: '#1a1a2e',
        opacity: eliminado ? 0.5 : 1,
        border: esPropio
          ? '1px solid #f59e0b'
          : eliminado
          ? '1px solid #334155'
          : '1px solid #1e293b',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm" style={{ color: '#f1f5f9' }}>
            {nombre}
          </p>
          {esPropio && (
            <span className="text-xs" style={{ color: '#f59e0b' }}>
              Tu equipo
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-mono font-bold" style={{ color: '#f59e0b' }}>
            {formatPuntos(puntos)}
          </p>
          <p className="text-xs" style={{ color: '#64748b' }}>
            puntos
          </p>
        </div>
      </div>
      {eliminado && (
        <p className="text-xs mt-2" style={{ color: '#ef4444' }}>
          ❌ Eliminado
        </p>
      )}
    </div>
  );
}
