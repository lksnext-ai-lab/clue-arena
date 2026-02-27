/**
 * Tests de consistencia de constantes del juego (RFC F010, §10).
 * Verifica que SOSPECHOSOS, ARMAS, HABITACIONES y sus metadatos de UI
 * sean coherentes entre sí y con los assets de imagen.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SOSPECHOSOS,
  ARMAS,
  HABITACIONES,
  PERSONAJE_META,
  ARMA_META,
  ESCENARIO_META,
} from '@/types/domain';

const PUBLIC_DIR = join(process.cwd(), 'public');

describe('Constantes del juego — cardinalidad', () => {
  it('SOSPECHOSOS tiene exactamente 6 elementos', () => {
    expect(SOSPECHOSOS).toHaveLength(6);
  });

  it('ARMAS tiene exactamente 6 elementos', () => {
    expect(ARMAS).toHaveLength(6);
  });

  it('HABITACIONES tiene exactamente 9 elementos', () => {
    expect(HABITACIONES).toHaveLength(9);
  });
});

describe('PERSONAJE_META — consistencia con SOSPECHOSOS', () => {
  it('todos los sospechosos tienen entrada en PERSONAJE_META', () => {
    for (const s of SOSPECHOSOS) {
      expect(PERSONAJE_META).toHaveProperty(s);
    }
  });

  it('PERSONAJE_META no tiene claves extra', () => {
    expect(Object.keys(PERSONAJE_META)).toHaveLength(SOSPECHOSOS.length);
  });

  it('cada PersonajeMeta tiene color, departamento y descripcion', () => {
    for (const s of SOSPECHOSOS) {
      const m = PERSONAJE_META[s];
      expect(m.color).toBeTruthy();
      expect(m.departamento).toBeTruthy();
      expect(m.descripcion).toBeTruthy();
    }
  });
});

describe('ARMA_META — consistencia con ARMAS', () => {
  it('todas las armas tienen entrada en ARMA_META', () => {
    for (const a of ARMAS) {
      expect(ARMA_META).toHaveProperty(a);
    }
  });

  it('ARMA_META no tiene claves extra', () => {
    expect(Object.keys(ARMA_META)).toHaveLength(ARMAS.length);
  });

  it('cada ArmaMeta tiene emoji', () => {
    for (const a of ARMAS) {
      expect(ARMA_META[a].emoji).toBeTruthy();
    }
  });
});

describe('ESCENARIO_META — consistencia con HABITACIONES', () => {
  it('todas las habitaciones tienen entrada en ESCENARIO_META', () => {
    for (const h of HABITACIONES) {
      expect(ESCENARIO_META).toHaveProperty(h);
    }
  });

  it('ESCENARIO_META no tiene claves extra', () => {
    expect(Object.keys(ESCENARIO_META)).toHaveLength(HABITACIONES.length);
  });

  it('cada EscenarioMeta tiene imagen y emoji', () => {
    for (const h of HABITACIONES) {
      expect(ESCENARIO_META[h].imagen).toBeTruthy();
      expect(ESCENARIO_META[h].emoji).toBeTruthy();
    }
  });

  it('todos los assets de imagen existen en public/', () => {
    for (const h of HABITACIONES) {
      const rel = ESCENARIO_META[h].imagen; // e.g. /game/escenarios/el-despacho-del-ceo.png
      const abs = join(PUBLIC_DIR, rel);
      expect(existsSync(abs), `Asset no encontrado: ${rel}`).toBe(true);
    }
  });
});

describe('Nombres canónicos — sin nombres clásicos del Cluedo', () => {
  const nombresClasicos = [
    'Coronel Mostaza', 'Señora Pavo Real', 'Reverendo Verde',
    'Señora Escarlata', 'Profesor Ciruela', 'Señorita Amapola',
    'Candelabro', 'Cuchillo', 'Tubo de plomo', 'Revólver', 'Cuerda', 'Llave inglesa',
    'Cocina', 'Salón de baile', 'Conservatorio', 'Comedor',
    'Sala de billar', 'Biblioteca', 'Sala de estar', 'Estudio', 'Vestíbulo',
  ];

  it('ningún nombre clásico aparece en SOSPECHOSOS', () => {
    for (const c of nombresClasicos) {
      expect(SOSPECHOSOS).not.toContain(c);
    }
  });

  it('ningún nombre clásico aparece en ARMAS', () => {
    for (const c of nombresClasicos) {
      expect(ARMAS).not.toContain(c);
    }
  });

  it('ningún nombre clásico aparece en HABITACIONES', () => {
    for (const c of nombresClasicos) {
      expect(HABITACIONES).not.toContain(c);
    }
  });
});
