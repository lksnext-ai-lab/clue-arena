'use client';

import type { TrainingGameResponse } from '@/types/api';

interface TrainingEnvelopeRevealProps {
  game: TrainingGameResponse;
  equipoId: string;
}

export function TrainingEnvelopeReveal({ game, equipoId }: TrainingEnvelopeRevealProps) {
  if (game.estado === 'en_curso') {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-slate-400">
        🔒 El sobre secreto se revelará al finalizar la partida
      </div>
    );
  }

  if (!game.sobres) {
    return null;
  }

  const won = game.resultado?.ganadorId === equipoId;
  const lost = game.resultado?.ganadorId && game.resultado.ganadorId !== equipoId;

  return (
    <div className={`rounded-lg border p-4 ${won ? 'border-green-600 bg-green-900/20' : 'border-slate-600 bg-slate-800'}`}>
      <p className="mb-3 text-lg font-bold text-white flex items-center gap-2">
        🔓 Sobre secreto revelado
        {won && <span className="text-green-400 text-base">(¡Tu agente ganó!)</span>}
        {lost && <span className="text-red-400 text-base">(Ganó otro equipo)</span>}
        {game.estado === 'abortada' && <span className="text-yellow-400 text-base">(Partida abortada{game.motivoAbort ? `: ${game.motivoAbort}` : ''})</span>}
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded bg-slate-700 px-3 py-2">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Sospechoso</p>
          <p className="font-semibold text-white">{game.sobres.sospechoso}</p>
        </div>
        <div className="rounded bg-slate-700 px-3 py-2">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Arma</p>
          <p className="font-semibold text-white">{game.sobres.arma}</p>
        </div>
        <div className="rounded bg-slate-700 px-3 py-2">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Habitación</p>
          <p className="font-semibold text-white">{game.sobres.habitacion}</p>
        </div>
      </div>

      {game.resultado && (
        <p className="mt-3 text-sm text-slate-400">
          Puntos simulados:{' '}
          <span className="font-mono text-white">{game.resultado.puntosSimulados}</span>
          {' '}
          <span className="text-xs">(no cuentan en el ranking)</span>
        </p>
      )}
    </div>
  );
}
