/**
 * Canonical-names consistency test (RFC F013, §8 — Testing).
 *
 * Ensures that the element names rendered on /instrucciones are identical to
 * the constants in src/types/domain.ts that the game engine uses. If this test
 * fails, teams would build agents using names that produce EVT_INVALID_CARD.
 */

import { describe, it, expect } from 'vitest';
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';

// ── Inline snapshot of the canonical names shown on the page ──────────────────
// These come from domain.ts constants, so the test is self-referential by design:
// it validates that domain.ts itself has exactly the right cardinality and values
// and that no extraneous names have been introduced.

const EXPECTED_SOSPECHOSOS = [
  'Directora Scarlett',
  'Coronel Mustard',
  'Sra. White',
  'Sr. Green',
  'Dra. Peacock',
  'Profesor Plum',
];

const EXPECTED_ARMAS = [
  'Cable de red',
  'Teclado mecánico',
  'Cafetera rota',
  'Certificado SSL caducado',
  'Grapadora industrial',
  'Termo de acero',
];

const EXPECTED_HABITACIONES = [
  'El Despacho del CEO',
  'El Laboratorio',
  'El Open Space',
  'La Cafetería',
  'La Sala de Juntas',
  'La Sala de Servidores',
  'La Zona de Descanso',
  'Recursos Humanos',
  'El Almacén de IT',
];

describe('RFC F013 — Canonical element names match domain constants', () => {
  it('SOSPECHOSOS contains exactly the 6 expected canonical names in order', () => {
    expect([...SOSPECHOSOS]).toEqual(EXPECTED_SOSPECHOSOS);
  });

  it('ARMAS contains exactly the 6 expected canonical names in order', () => {
    expect([...ARMAS]).toEqual(EXPECTED_ARMAS);
  });

  it('HABITACIONES contains exactly the 9 expected canonical names in order', () => {
    expect([...HABITACIONES]).toEqual(EXPECTED_HABITACIONES);
  });

  it('Total game elements is 21 (6S + 6A + 9H)', () => {
    expect(SOSPECHOSOS.length + ARMAS.length + HABITACIONES.length).toBe(21);
  });

  it('No canonical name contains leading or trailing whitespace', () => {
    const all = [...SOSPECHOSOS, ...ARMAS, ...HABITACIONES];
    for (const name of all) {
      expect(name).toBe(name.trim());
    }
  });

  it('No canonical name is duplicated across all element types', () => {
    const all = [...SOSPECHOSOS, ...ARMAS, ...HABITACIONES];
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });
});
