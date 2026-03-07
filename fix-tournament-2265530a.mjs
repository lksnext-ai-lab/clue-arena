/**
 * Fix script for tournament 2265530a-3d2a-47c4-a84a-e4f6d98a822a
 *
 * Problem: Round 4 (semifinal) is 'active' but has no games.
 * Cause:   generateBracketRound(4 teams, playersPerGame=6) produced 0 matches
 *          (all 4 teams got byes, no real game was created).
 *
 * Fix: Create a game for the 4 qualifiers and link it to round 4.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, './data/clue-arena.db');

const TOURNAMENT_ID = '2265530a-3d2a-47c4-a84a-e4f6d98a822a';
const ROUND_4_ID    = '12b5a344-1840-4434-b0ed-3d21093ee82c';
const MAX_TURNOS    = 10;
const GAME_NAME     = 'Torneo 2 — semifinal — partida 1';

// The 4 qualifiers (non-eliminated teams)
const QUALIFIER_TEAM_IDS = [
  'team-beta',    // Equipo Beta  — group 0, rnd3 score: 75
  'team-delta',   // Equipo Delta — group 0, rnd3 score: 65
  'dev-team-id',  // OT Team      — group 1, rnd3 score: 75
  'team-omega',   // Equipo Omega — group 1, rnd3 score: 65
];

// --- Seeded RNG (same mulberry32 used by game engine) ---
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Card constants (must match src/types/domain.ts)
const SOSPECHOSOS  = ['Directora Scarlett', 'Coronel Mustard', 'Sra. White', 'Sr. Green', 'Dra. Peacock', 'Profesor Plum'];
const ARMAS        = ['Cable de red', 'Teclado mecánico', 'Cafetera rota', 'Certificado SSL caducado', 'Grapadora industrial', 'Termo de acero'];
const HABITACIONES = ['El Despacho del CEO', 'El Laboratorio', 'El Open Space', 'La Cafetería', 'La Sala de Juntas', 'La Sala de Servidores', 'La Zona de Descanso', 'Recursos Humanos', 'El Almacén de IT'];

function initGame(equipoIds, seed) {
  const resolvedSeed = seed ?? Date.now();
  const rand = mulberry32(resolvedSeed);

  const allCards = [...SOSPECHOSOS, ...ARMAS, ...HABITACIONES];

  const randomSospechoso = SOSPECHOSOS[Math.floor(rand() * SOSPECHOSOS.length)];
  const randomArma       = ARMAS[Math.floor(rand() * ARMAS.length)];
  const randomHabitacion = HABITACIONES[Math.floor(rand() * HABITACIONES.length)];

  const sobre = { sospechoso: randomSospechoso, arma: randomArma, habitacion: randomHabitacion };

  const remaining = allCards.filter(
    (c) => c !== sobre.sospechoso && c !== sobre.arma && c !== sobre.habitacion,
  );
  const shuffled = shuffle(remaining, rand);

  const equipos = equipoIds.map((id, i) => ({
    equipoId: id,
    orden: i,
    cartas: [],
  }));

  shuffled.forEach((carta, idx) => {
    equipos[idx % equipos.length].cartas.push(carta);
  });

  return { sobre, equipos, seed: resolvedSeed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Verify current state
const round = db.prepare('SELECT * FROM tournament_rounds WHERE id = ?').get(ROUND_4_ID);
if (!round) {
  console.error('Round 4 not found — nothing to fix.');
  process.exit(1);
}

const existingGames = db
  .prepare('SELECT COUNT(*) as cnt FROM tournament_round_games WHERE round_id = ? AND is_bye = false')
  .get(ROUND_4_ID);

if (existingGames.cnt > 0) {
  console.error(`Round 4 already has ${existingGames.cnt} non-bye game(s) — no fix needed.`);
  process.exit(0);
}

console.log('Round 4 status:', round.status, '| games:', existingGames.cnt);
console.log('Creating semifinal game for qualifiers:', QUALIFIER_TEAM_IDS);

const gameState = initGame(QUALIFIER_TEAM_IDS);
const gameId    = randomUUID();
const now       = Date.now();

const fix = db.transaction(() => {
  // 1. Insert partidas record
  db.prepare(`
    INSERT INTO partidas (id, nombre, estado, turno_actual, created_at, max_turnos, modo_ejecucion, turno_delay_ms)
    VALUES (?, ?, 'pendiente', 0, ?, ?, 'manual', 3000)
  `).run(gameId, GAME_NAME, now, MAX_TURNOS);

  // 2. Insert sobres record (solution envelope)
  db.prepare(`
    INSERT INTO sobres (id, partida_id, sospechoso, arma, habitacion)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), gameId, gameState.sobre.sospechoso, gameState.sobre.arma, gameState.sobre.habitacion);

  // 3. Insert partida_equipos for each qualifier
  for (const equipo of gameState.equipos) {
    db.prepare(`
      INSERT INTO partida_equipos (id, partida_id, equipo_id, orden, eliminado, puntos, cartas)
      VALUES (?, ?, ?, ?, false, 0, ?)
    `).run(randomUUID(), gameId, equipo.equipoId, equipo.orden, JSON.stringify(equipo.cartas));
  }

  // 4. Link game to round 4
  db.prepare(`
    INSERT INTO tournament_round_games (id, round_id, game_id, is_bye)
    VALUES (?, ?, ?, false)
  `).run(randomUUID(), ROUND_4_ID, gameId);
});

fix();

// Verify
const linked = db
  .prepare('SELECT trg.*, p.nombre, p.estado FROM tournament_round_games trg JOIN partidas p ON trg.game_id = p.id WHERE trg.round_id = ?')
  .all(ROUND_4_ID);

console.log('\n✔ Fixed. Round 4 games:');
for (const g of linked) {
  console.log(`  game_id=${g.game_id}  name="${g.nombre}"  estado=${g.estado}  is_bye=${g.is_bye}`);
}

const teamRows = db
  .prepare(`
    SELECT pe.equipo_id, e.nombre, pe.orden, json_array_length(pe.cartas) as num_cartas
    FROM partida_equipos pe JOIN equipos e ON pe.equipo_id = e.id
    WHERE pe.partida_id = ?
    ORDER BY pe.orden
  `)
  .all(gameId);

console.log('\n  Enrolled teams:');
for (const t of teamRows) {
  console.log(`    [${t.orden}] ${t.nombre} (${t.equipo_id}) — ${t.num_cartas} cards`);
}

console.log(`\n  Solution: ${gameState.sobre.sospechoso} | ${gameState.sobre.arma} | ${gameState.sobre.habitacion}`);
console.log('\nDone. Tournament round 4 is now consistent.');

db.close();
