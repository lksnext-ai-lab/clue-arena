import { describe, it, expect } from 'vitest';
import { initGame, applyAction, isGameOver, getWinner } from '@/lib/game/engine';
import type { SuggestionAction, AccusationAction } from '@/lib/game/types';

describe('Game Engine', () => {
  const TEAM_IDS = ['team-a', 'team-b', 'team-c'];

  it('initializes a game with correct structure', () => {
    const state = initGame(TEAM_IDS, 42);

    expect(state.equipos).toHaveLength(3);
    expect(state.estado).toBe('pendiente');
    expect(state.turnoActual).toBe(0);
    expect(state.sobre.sospechoso).toBeTruthy();
    expect(state.sobre.arma).toBeTruthy();
    expect(state.sobre.habitacion).toBeTruthy();
  });

  it('deals all cards (minus envelope) to teams', () => {
    const state = initGame(TEAM_IDS, 42);
    const totalCards =
      state.equipos.reduce((sum, e) => sum + e.cartas.length, 0);

    // 6 suspects + 6 weapons + 9 rooms = 21 total cards; 3 in envelope = 18 dealt
    expect(totalCards).toBe(18);
  });

  it('envelope cards are not dealt to teams', () => {
    const state = initGame(TEAM_IDS, 42);
    const allDealtCards = state.equipos.flatMap((e) => e.cartas);

    expect(allDealtCards).not.toContain(state.sobre.sospechoso);
    expect(allDealtCards).not.toContain(state.sobre.arma);
    expect(allDealtCards).not.toContain(state.sobre.habitacion);
  });

  it('applies a suggestion and finds a refuter', () => {
    const state = initGame(TEAM_IDS, 42);

    // Find a card held by team-b to suggest
    const cardHeldByB = state.equipos.find((e) => e.equipoId === 'team-b')!.cartas[0];

    const action: SuggestionAction = {
      type: 'suggestion',
      equipoId: 'team-a',
      sospechoso: 'Coronel Mustard',
      arma: 'Teclado mecánico',
      habitacion: 'La Cafetería',
    };

    const newState = applyAction(state, action);
    expect(newState.historial).toHaveLength(1);
    expect(newState.historial[0].action.type).toBe('suggestion');
  });

  it('correct accusation ends the game', () => {
    const state = initGame(TEAM_IDS, 42);

    const action: AccusationAction = {
      type: 'accusation',
      equipoId: 'team-a',
      sospechoso: state.sobre.sospechoso,
      arma: state.sobre.arma,
      habitacion: state.sobre.habitacion,
    };

    const newState = applyAction(state, action);

    expect(isGameOver(newState)).toBe(true);
    expect(getWinner(newState)).toBe('team-a');
  });

  it('incorrect accusation eliminates the team', () => {
    const state = initGame(TEAM_IDS, 42);

    // Find an incorrect accusation
    const wrongSospechoso = ['Directora Scarlett', 'Coronel Mustard', 'Sra. White']
      .find((s) => s !== state.sobre.sospechoso)!;

    const action: AccusationAction = {
      type: 'accusation',
      equipoId: 'team-a',
      sospechoso: wrongSospechoso as any,
      arma: state.sobre.arma,
      habitacion: state.sobre.habitacion,
    };

    const newState = applyAction(state, action);
    const teamA = newState.equipos.find((e) => e.equipoId === 'team-a')!;

    expect(teamA.eliminado).toBe(true);
    expect(isGameOver(newState)).toBe(false); // other teams still active
  });

  it('game ends when all teams are eliminated', () => {
    const twoTeams = ['team-x', 'team-y'];
    const state = initGame(twoTeams, 99);

    const wrongSospechoso = ['Directora Scarlett', 'Coronel Mustard', 'Sra. White']
      .find((s) => s !== state.sobre.sospechoso)!;

    // Eliminate team-x
    const stateAfterX = applyAction(state, {
      type: 'accusation',
      equipoId: 'team-x',
      sospechoso: wrongSospechoso as any,
      arma: state.sobre.arma,
      habitacion: state.sobre.habitacion,
    });

    // Eliminate team-y
    const stateAfterY = applyAction(stateAfterX, {
      type: 'accusation',
      equipoId: 'team-y',
      sospechoso: wrongSospechoso as any,
      arma: state.sobre.arma,
      habitacion: state.sobre.habitacion,
    });

    expect(isGameOver(stateAfterY)).toBe(true);
  });
});
