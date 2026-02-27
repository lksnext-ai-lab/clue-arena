/**
 * deduction-board.ts
 * Pure utility — no I/O.
 * Builds a public deduction board from the action history.
 * Only reflects cards mentioned in public suggestions (not hand ownership).
 */

import type { TurnResponse } from '@/types/api';
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';

export type CardCategory = 'sospechoso' | 'arma' | 'habitacion';

export interface DeductionCell {
  card: string;
  category: CardCategory;
  teamId: string;
  /** Turn numbers in which this team mentioned this card in a suggestion */
  turnos: number[];
}

/** Indexed by `${teamId}::${card}` */
export type DeductionBoard = Map<string, DeductionCell>;

export { SOSPECHOSOS, ARMAS, HABITACIONES };

export const ALL_CARDS: { card: string; category: CardCategory }[] = [
  ...SOSPECHOSOS.map((c) => ({ card: c, category: 'sospechoso' as CardCategory })),
  ...ARMAS.map((c) => ({ card: c, category: 'arma' as CardCategory })),
  ...HABITACIONES.map((c) => ({ card: c, category: 'habitacion' as CardCategory })),
];

function boardKey(teamId: string, card: string): string {
  return `${teamId}::${card}`;
}

/**
 * Builds a DeductionBoard from the public historial (turnos).
 * For each suggestion in every turn, registers the three cards
 * (sospechoso, arma, habitación) against the suggesting team.
 */
export function buildDeductionBoard(
  turnos: TurnResponse[],
  equipoIds: string[]
): DeductionBoard {
  const board: DeductionBoard = new Map();

  // Pre-populate all (team × card) cells as empty
  for (const { card, category } of ALL_CARDS) {
    for (const teamId of equipoIds) {
      const key = boardKey(teamId, card);
      board.set(key, { card, category, teamId, turnos: [] });
    }
  }

  // Fill in from suggestion history
  for (const turno of turnos) {
    for (const s of turno.sugerencias) {
      const cards: { card: string; category: CardCategory }[] = [
        { card: s.sospechoso, category: 'sospechoso' },
        { card: s.arma, category: 'arma' },
        { card: s.habitacion, category: 'habitacion' },
      ];
      for (const { card, category } of cards) {
        const key = boardKey(s.equipoId, card);
        const existing = board.get(key);
        if (existing) {
          existing.turnos.push(turno.numero);
        } else {
          // Card not in canonical list (custom game), still track it
          board.set(key, { card, category, teamId: s.equipoId, turnos: [turno.numero] });
        }
      }
    }
  }

  return board;
}

export { boardKey };
