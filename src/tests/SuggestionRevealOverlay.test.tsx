import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SuggestionRevealOverlay } from '@/components/game/SuggestionRevealOverlay';
import { GameProvider, useGame } from '@/contexts/GameContext';
import type { GameDetailResponse } from '@/types/api';

// helper to build minimal fake data
function makePartidaWithSuggestion(): GameDetailResponse {
  const now = new Date().toISOString();
  return {
    id: 'g1',
    nombre: 'Test',
    estado: 'en_curso',
    turnoActual: 1,
    maxTurnos: null,
    modoEjecucion: 'manual',
    autoRunActivoDesde: null,
    equipos: [
      { id: 't1', equipoId: 'eq1', equipoNombre: 'Equipo 1', avatarUrl: null, orden: 1, eliminado: false, puntos: 0, numCartas: 0 },
    ],
    createdAt: now,
    startedAt: now,
    finishedAt: null,
    activeEquipoId: null,
    turnos: [
      {
        id: 'turno1',
        equipoId: 'eq1',
        equipoNombre: 'Equipo 1',
        numero: 1,
        estado: 'ok',
        sugerencias: [
          {
            id: 's1',
            equipoId: 'eq1',
            sospechoso: 'Prof. Plum',
            arma: 'Candelabro',
            habitacion: 'Biblioteca',
            refutadaPor: null,
            createdAt: now,
          },
        ],
      },
    ],
  };
}

describe('SuggestionRevealOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra la sugerencia y la oculta tras 2 segundos', () => {
    const partida = makePartidaWithSuggestion();

    act(() => {
      render(
        <GameProvider gameId="test">
          <SuggestionRevealOverlay partida={partida} />
        </GameProvider>
      );
    });

    // overlay debería estar visible inmediatamente
    expect(screen.getByText(/Sugerencia/i)).toBeInTheDocument();

    // avanzar lo suficiente para que se ejecute todo el proceso de
    // disolución (2s visible + 0.8s de animación)
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText(/Sugerencia/i)).toBeNull();
  });


  // verify that GameContext delays activeEquipoId updates until the suggestion
  // overlay animation ends
  it('no avanza equipo activo hasta que termine la animación', () => {
  const results: { ctx?: ReturnType<typeof useGame> } = {};

  function Consumer() {
    const ctx = useGame();
    results.ctx = ctx;
    return null;
  }

  render(
    <GameProvider gameId="test">
      <Consumer />
    </GameProvider>
  );

  expect(results.ctx?.activeEquipoId).toBeNull();
  act(() => {
    results.ctx?.notifySuggestionAnimationStart();
    results.ctx?.scheduleActiveEquipoId('equipo-42');
  });
  expect(results.ctx?.activeEquipoId).toBeNull();
  act(() => {
    results.ctx?.notifySuggestionAnimationEnd();
  });
  expect(results.ctx?.activeEquipoId).toBe('equipo-42');
  });

  it('delay update when schedule happens before animation start (race)', () => {
  const results: { ctx?: ReturnType<typeof useGame> } = {};

  function Consumer() {
    const ctx = useGame();
    results.ctx = ctx;
    return null;
  }

  render(
    <GameProvider gameId="test">
      <Consumer />
    </GameProvider>
  );

  expect(results.ctx?.activeEquipoId).toBeNull();

  // schedule first, then notify start immediately (race condition)
  act(() => {
    results.ctx?.scheduleActiveEquipoId('eq-race');
    results.ctx?.notifySuggestionAnimationStart();
  });

  // even though schedule ran first, animation start should prevent commit
  expect(results.ctx?.activeEquipoId).toBeNull();

  act(() => {
    results.ctx?.notifySuggestionAnimationEnd();
  });

  expect(results.ctx?.activeEquipoId).toBe('eq-race');
  });

  it('applies update immediately when no animation in progress', () => {
  // ensure timers are mocked (extra safety beyond the describe-level beforeEach)
  vi.useFakeTimers();
  const results: { ctx?: ReturnType<typeof useGame> } = {};

  function Consumer() {
    const ctx = useGame();
    results.ctx = ctx;
    return null;
  }

  render(
    <GameProvider gameId="test">
      <Consumer />
    </GameProvider>
  );

  expect(results.ctx?.activeEquipoId).toBeNull();
  act(() => {
    results.ctx?.scheduleActiveEquipoId('eq-immediate');
  });
  // should not update instantly; timer must tick
  expect(results.ctx?.activeEquipoId).toBeNull();
  act(() => {
    vi.advanceTimersByTime(25);
  });
  expect(results.ctx?.activeEquipoId).toBe('eq-immediate');
});

});
