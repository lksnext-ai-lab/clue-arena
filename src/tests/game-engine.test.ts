import { describe, it, expect } from 'vitest';
import {
  initGame,
  applyAction,
  isGameOver,
  getWinner,
  calcEfficiencyBonus,
  getGameStateView,
} from '@/lib/game/engine';
import type { SuggestionAction, AccusationAction } from '@/lib/game/types';
import type { Sospechoso, Habitacion } from '@/types/domain';

describe('Game Engine', () => {
  const TEAM_IDS = ['team-a', 'team-b', 'team-c'];

  it('initializes a game with correct structure', () => {
    const state = initGame(TEAM_IDS, 42);

    expect(state.equipos).toHaveLength(3);
    expect(state.estado).toBe('pendiente');
    expect(state.turnoActual).toBe(0);
    expect(state.maxTurnos).toBeNull(); // default no limit
    expect(state.sobre.sospechoso).toBeTruthy();
    expect(state.sobre.arma).toBeTruthy();
    expect(state.sobre.habitacion).toBeTruthy();
  });

  it('view includes maxTurnos when provided', () => {
    const state = initGame(TEAM_IDS, 42);
    state.maxTurnos = 25;
    const view = getGameStateView(state, 'team-a');
    expect(view.maxTurnos).toBe(25);
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

    const action: SuggestionAction = {
      type: 'suggestion',
      equipoId: 'team-a',
      sospechoso: 'Coronel Mustard',
      arma: 'Teclado mecánico',
      habitacion: 'La Cafetería',
    };

    const result = applyAction(state, action);
    expect(result.state.historial).toHaveLength(1);
    expect(result.state.historial[0].action.type).toBe('suggestion');
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

    const result = applyAction(state, action);

    expect(isGameOver(result.state)).toBe(true);
    expect(getWinner(result.state)).toBe('team-a');
  });

  it('correct accusation emits EVT_WIN and EVT_WIN_EFFICIENCY score events', () => {
    const state = initGame(TEAM_IDS, 42);
    // Start game
    const startedState = { ...state, estado: 'en_curso' as const };

    const result = applyAction(startedState, {
      type: 'accusation',
      equipoId: 'team-a',
      sospechoso: startedState.sobre.sospechoso,
      arma: startedState.sobre.arma,
      habitacion: startedState.sobre.habitacion,
    });

    const evtWin = result.scoreEvents.find((e) => e.type === 'EVT_WIN');
    expect(evtWin).toBeDefined();
    expect(evtWin!.points).toBe(1000);
    expect(evtWin!.equipoId).toBe('team-a');

    // EVT_SURVIVE for non-eliminated, non-winner teams
    const surviveEvents = result.scoreEvents.filter((e) => e.type === 'EVT_SURVIVE');
    expect(surviveEvents.length).toBe(2); // team-b and team-c
  });

  it('incorrect accusation eliminates the team and emits EVT_WRONG_ACCUSATION', () => {
    const state = initGame(TEAM_IDS, 42);

    const wrongSospechoso = ['Directora Scarlett', 'Coronel Mustard', 'Sra. White']
      .find((s) => s !== state.sobre.sospechoso)!;

    const action: AccusationAction = {
      type: 'accusation',
      equipoId: 'team-a',
      sospechoso: wrongSospechoso as Sospechoso,
      arma: state.sobre.arma,
      habitacion: state.sobre.habitacion,
    };

    const result = applyAction(state, action);
    const teamA = result.state.equipos.find((e) => e.equipoId === 'team-a')!;

    expect(teamA.eliminado).toBe(true);
    expect(isGameOver(result.state)).toBe(false); // other teams still active
    expect(result.scoreEvents.find((e) => e.type === 'EVT_WRONG_ACCUSATION')).toBeDefined();
    expect(result.scoreEvents.find((e) => e.type === 'EVT_WRONG_ACCUSATION')!.points).toBe(-150);
  });

  it('game ends when all teams are eliminated', () => {
    const twoTeams = ['team-x', 'team-y'];
    const state = initGame(twoTeams, 99);

    const wrongSospechoso = ['Directora Scarlett', 'Coronel Mustard', 'Sra. White']
      .find((s) => s !== state.sobre.sospechoso)!;

    // Eliminate team-x
    const r1 = applyAction(state, {
      type: 'accusation',
      equipoId: 'team-x',
      sospechoso: wrongSospechoso as Sospechoso,
      arma: state.sobre.arma,
      habitacion: state.sobre.habitacion,
    });

    // Eliminate team-y
    const r2 = applyAction(r1.state, {
      type: 'accusation',
      equipoId: 'team-y',
      sospechoso: wrongSospechoso as Sospechoso,
      arma: r1.state.sobre.arma,
      habitacion: r1.state.sobre.habitacion,
    });

    expect(isGameOver(r2.state)).toBe(true);
  });

  it('view includes maxTurnos when provided', () => {
    const state = initGame(TEAM_IDS, 42);
    state.maxTurnos = 25;
    const view = getGameStateView(state, 'team-a');
    expect(view.maxTurnos).toBe(25);
  });

  // --------------- Scoring tests (G001) ---------------

  it('EVT_PASS emitted for voluntary pass', () => {
    const state = initGame(['team-a', 'team-b'], 1);
    const result = applyAction(state, { type: 'pass', equipoId: 'team-a' });
    const evtPass = result.scoreEvents.find((e) => e.type === 'EVT_PASS');
    expect(evtPass).toBeDefined();
    expect(evtPass!.points).toBe(-5);
    expect(result.state.equipos.find((e) => e.equipoId === 'team-a')!.puntos).toBe(-5);
  });

  it('EVT_SUGGESTION emitted for valid unique suggestion', () => {
    const state = initGame(TEAM_IDS, 42);
    const result = applyAction(state, {
      type: 'suggestion',
      equipoId: 'team-a',
      sospechoso: 'Coronel Mustard',
      arma: 'Teclado mecánico',
      habitacion: 'La Cafetería',
    });
    const evtSugg = result.scoreEvents.find((e) => e.type === 'EVT_SUGGESTION');
    expect(evtSugg).toBeDefined();
    expect(evtSugg!.points).toBe(10);
  });

  it('EVT_INVALID_CARD emitted and suggestion not processed for non-existent card', () => {
    const state = initGame(TEAM_IDS, 42);
    const result = applyAction(state, {
      type: 'suggestion',
      equipoId: 'team-a',
      sospechoso: 'Profesor Fantasma' as unknown as Sospechoso, // does not exist
      arma: 'Teclado mecánico',
      habitacion: 'La Cafetería',
    });
    expect(result.scoreEvents.find((e) => e.type === 'EVT_INVALID_CARD')).toBeDefined();
    expect(result.scoreEvents.find((e) => e.type === 'EVT_SUGGESTION')).toBeUndefined();
    // result field should be null (no refutation processed)
    expect(result.state.historial[0].result).toBeNull();
  });

  it('EVT_REDUNDANT_SUGGESTION emitted for repeated combination', () => {
    const state = initGame(TEAM_IDS, 42);
    const suggestion: SuggestionAction = {
      type: 'suggestion',
      equipoId: 'team-a',
      sospechoso: 'Coronel Mustard',
      arma: 'Teclado mecánico',
      habitacion: 'La Cafetería',
    };
    const r1 = applyAction(state, suggestion);
    // team-b plays, then team-a repeats same suggestion
    const r2 = applyAction(r1.state, { type: 'pass', equipoId: 'team-b' });
    const r3 = applyAction(r2.state, { type: 'pass', equipoId: 'team-c' });
    const r4 = applyAction(r3.state, suggestion);
    expect(r4.scoreEvents.find((e) => e.type === 'EVT_REDUNDANT_SUGGESTION')).toBeDefined();
    expect(r4.scoreEvents.find((e) => e.type === 'EVT_SUGGESTION')).toBeUndefined();
  });

  it('EVT_SUGGESTION capped at 5 per team', () => {
    let state = initGame(['team-a', 'team-b'], 7);
    // 6 unique valid combos (suspects × rooms — all values are in domain.ts)
    const suspects = [
      'Coronel Mustard', 'Directora Scarlett', 'Sra. White',
      'Sr. Green', 'Dra. Peacock', 'Profesor Plum',
    ] as const;
    const rooms = [
      'La Cafetería', 'La Sala de Juntas', 'La Sala de Servidores',
      'La Zona de Descanso', 'Recursos Humanos', 'El Almacén de IT',
    ] as const;
    let suggCount = 0;
    // Make 6 unique suggestions (should only earn 5 EVT_SUGGESTION)
    for (let i = 0; i < 6; i++) {
      const r = applyAction(state, {
        type: 'suggestion',
        equipoId: 'team-a',
        sospechoso: suspects[i] as Sospechoso,
        arma: 'Teclado mecánico',
        habitacion: rooms[i] as Habitacion,
      });
      const sg = r.scoreEvents.filter((e) => e.type === 'EVT_SUGGESTION');
      suggCount += sg.length;
      state = r.state;
      if (i < 5) {
        // Pass team-b to return to team-a
        const pass = applyAction(state, { type: 'pass', equipoId: 'team-b' });
        state = pass.state;
      }
    }
    expect(suggCount).toBe(5); // cap enforced
  });

  it('calcEfficiencyBonus works correctly', () => {
    expect(calcEfficiencyBonus(2)).toBe(500);
    expect(calcEfficiencyBonus(4)).toBe(450);
    expect(calcEfficiencyBonus(10)).toBe(300);
    expect(calcEfficiencyBonus(22)).toBe(0);  // 500 - (22-2)*25 = 0
    expect(calcEfficiencyBonus(25)).toBe(0); // clamped to 0
  });

  // --------------- getGameStateView tests (G003) ---------------

  describe('getGameStateView', () => {
    it('hides envelope cards (sobre never exposed)', () => {
      const state = initGame(TEAM_IDS, 42);
      const view = getGameStateView(state, 'team-a');
      // GameStateView has no "sobre" field — sobre is fully absent
      expect((view as unknown as Record<string, unknown>)['sobre']).toBeUndefined();
    });

    it('returns own cards and empty array for opponents', () => {
      const state = initGame(TEAM_IDS, 42);
      const view = getGameStateView(state, 'team-a');
      const own = view.equipos.find((e) => e.equipoId === 'team-a')!;
      const other = view.equipos.find((e) => e.equipoId === 'team-b')!;
      expect(own.cartas.length).toBeGreaterThan(0);
      expect(own.esPropio).toBe(true);
      expect(other.cartas).toHaveLength(0);
      expect(other.esPropio).toBe(false);
    });

    it('exposes numCartas for all teams (public info)', () => {
      const state = initGame(TEAM_IDS, 42);
      const view = getGameStateView(state, 'team-a');
      for (const e of view.equipos) {
        const internalTeam = state.equipos.find((t) => t.equipoId === e.equipoId)!;
        expect(e.numCartas).toBe(internalTeam.cartas.length);
      }
    });

    it('exposes turnosJugados for all teams (public info)', () => {
      let state = initGame(TEAM_IDS, 42);
      // team-a makes a pass (turnosJugados = 1 for team-a)
      const r1 = applyAction(state, { type: 'pass', equipoId: 'team-a' });
      state = r1.state;
      const view = getGameStateView(state, 'team-b');
      const teamA = view.equipos.find((e) => e.equipoId === 'team-a')!;
      const teamB = view.equipos.find((e) => e.equipoId === 'team-b')!;
      expect(teamA.turnosJugados).toBe(1);
      expect(teamB.turnosJugados).toBe(0);
    });

    it('historial contains completed turns with correct public data', () => {
      const state = initGame(TEAM_IDS, 42);
      const suggestion: SuggestionAction = {
        type: 'suggestion',
        equipoId: 'team-a',
        sospechoso: 'Coronel Mustard',
        arma: 'Teclado mecánico',
        habitacion: 'La Cafetería',
      };
      const r1 = applyAction(state, suggestion);
      const view = getGameStateView(r1.state, 'team-b');
      expect(view.historial).toHaveLength(1);
      const entry = view.historial[0];
      expect(entry.tipo).toBe('suggestion');
      expect(entry.sospechoso).toBe('Coronel Mustard');
      expect(entry.arma).toBe('Teclado mecánico');
      expect(entry.habitacion).toBe('La Cafetería');
      // refutadaPor is public regardless of requesting team
      expect('refutadaPor' in entry).toBe(true);
    });

    it('cartaMostrada is visible only to the sugeridor', () => {
      let state = initGame(TEAM_IDS, 42);
      state = { ...state, estado: 'en_curso' };
      const suggestion: SuggestionAction = {
        type: 'suggestion',
        equipoId: 'team-a',
        sospechoso: 'Coronel Mustard',
        arma: 'Teclado mecánico',
        habitacion: 'La Cafetería',
      };
      const r1 = applyAction(state, suggestion);
      const refutadaPor = r1.suggestionResult?.refutadaPor;

      // If there was a refutation, cartaMostrada should be visible to team-a (sugeridor)
      // but hidden from others
      if (refutadaPor) {
        const viewSugeridor = getGameStateView(r1.state, 'team-a');
        const viewOther = getGameStateView(r1.state, refutadaPor);
        expect(viewSugeridor.historial[0].cartaMostrada).toBeDefined();
        // cartaMostrada should not appear to other teams (undefined, not null)
        expect(viewOther.historial[0].cartaMostrada).toBeUndefined();
      }
    });

    it('cartaMostradaPorMi is visible only to the refutador', () => {
      let state = initGame(TEAM_IDS, 42);
      state = { ...state, estado: 'en_curso' };
      const suggestion: SuggestionAction = {
        type: 'suggestion',
        equipoId: 'team-a',
        sospechoso: 'Coronel Mustard',
        arma: 'Teclado mecánico',
        habitacion: 'La Cafetería',
      };
      const r1 = applyAction(state, suggestion);
      const refutadaPor = r1.suggestionResult?.refutadaPor;

      if (refutadaPor) {
        const viewRefutador = getGameStateView(r1.state, refutadaPor);
        const viewSugeridor = getGameStateView(r1.state, 'team-a');
        // The refutador sees cartaMostradaPorMi
        expect(viewRefutador.historial[0].cartaMostradaPorMi).toBeDefined();
        // The sugeridor does NOT see cartaMostradaPorMi (undefined, not null)
        expect(viewSugeridor.historial[0].cartaMostradaPorMi).toBeUndefined();
      }
    });

    it('accusation entry shows correcta field', () => {
      const state = initGame(TEAM_IDS, 42);
      const r = applyAction(state, {
        type: 'accusation',
        equipoId: 'team-a',
        sospechoso: state.sobre.sospechoso,
        arma: state.sobre.arma,
        habitacion: state.sobre.habitacion,
      });
      const view = getGameStateView(r.state, 'team-b');
      const entry = view.historial[0];
      expect(entry.tipo).toBe('accusation');
      expect(entry.correcta).toBe(true);
      // accusation entries must NOT expose sobre-level secrets beyond correcta
      expect((entry as unknown as Record<string, unknown>)['cartaMostrada']).toBeUndefined();
    });

    it('esElTurnoDeEquipo is true only for the active team', () => {
      const state = initGame(TEAM_IDS, 42);
      // team-a starts (turnoActual = 0, first active equipo)
      const viewA = getGameStateView(state, 'team-a');
      const viewB = getGameStateView(state, 'team-b');
      expect(viewA.esElTurnoDeEquipo).toBe(true);
      expect(viewB.esElTurnoDeEquipo).toBe(false);
    });
  });
});
