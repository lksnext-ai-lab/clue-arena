import { formatFecha } from '@/lib/utils/formatting';
import type { SuggestionResponse } from '@/types/api';

interface SuggestionRowProps {
  suggestion: SuggestionResponse;
  equipoNombre: string;
  refutadorNombre?: string;
  showCard?: boolean; // true only for admin or the team that made the suggestion
}

export function SuggestionRow({
  suggestion,
  equipoNombre,
  refutadorNombre,
  showCard,
}: SuggestionRowProps) {
  return (
    <div
      className="text-xs px-4 py-2 rounded-md"
      style={{ background: '#0f172a' }}
    >
      <p className="font-medium mb-0.5" style={{ color: '#94a3b8' }}>
        {equipoNombre}
      </p>
      <p style={{ color: '#f1f5f9' }}>
        💬 {suggestion.sospechoso} con {suggestion.arma} en {suggestion.habitacion}
      </p>
      {suggestion.refutadaPor ? (
        <p style={{ color: '#64748b' }}>
          Refutada por {refutadorNombre ?? suggestion.refutadaPor}
          {showCard && suggestion.cartaMostrada && (
            <span style={{ color: '#f59e0b' }}> · Carta: {suggestion.cartaMostrada}</span>
          )}
        </p>
      ) : (
        <p style={{ color: '#22c55e' }}>No refutada</p>
      )}
      <p className="mt-0.5" style={{ color: '#475569' }}>
        {formatFecha(suggestion.createdAt)}
      </p>
    </div>
  );
}
