/**
 * Fix script for tournament e27b3b20-4861-46ff-b808-814c9c030ef7 (Copa 2)
 *
 * Problem: Round 2 (final) was created when round 1 advance partially succeeded,
 *          but no games were inserted (FK constraint on 'bye' gameId crashed createRound
 *          before it could insert the real match).
 *          generateBracketRound also put 2 survivors in byes (2 < playersPerGame=4),
 *          so no real game would have been created anyway.
 *
 * Fix: Create a final game for the 2 survivors and link it to round 2.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, './data/clue-arena.db');

const TOURNAMENT_ID = 'e27b3b20-4861-46ff-b808-814c9c030ef7';
const ROUND_2_ID    = 'ecb831ac-98cc-4cc6-ac04-7bb9c1f658fc';
const MAX_TURNOS    = 10;
const GAME_NAME     = 'Copa 2 — final — partida 1';

// The 2 survivors (non-eliminated after round 1)
const SURVIVOR_TEAM_IDS = [
  '0d95a1fa-6de8-475d-86b2-a5c5a5ec90a2', // test
  'team-alpha',                             // Equipo Alpha
];

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
  const remaining = allCards.filter((c) => c !== sobre.sospechoso && c !== sobre.arma && c !== sobre.habitacion);
  const shuffled = shuffle(remaining, rand);
  const equipos = equipoIds.map((id, i) => ({ equipoId: id, orden: i, cartas: [] }));
  shuffled.forEach((carta, idx) => { equipos[idx % equipos.length].cartas.push(carta); });
  return { sobre, equipos };
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const round = db.prepare('SELECT * FROM tournament_rounds WHERE id = ?').get(ROUND_2_ID);
if (!round) { console.error('Round 2 not found.'); process.exit(1); }

const existing = db.prepare('SELECT COUNT(*) as cnt FROM tournament_round_games WHERE round_id = ? AND is_bye = false').get(ROUND_2_ID);
if (existing.cnt > 0) { console.error(`Round 2 already has ${existing.cnt} game(s).`); process.exit(0); }

console.log(`Round 2 status: ${round.status} | real games: ${existing.cnt}`);
console.log('Creating final game for survivors:', SURVIVOR_TEAM_IDS);

const gameState = initGame(SURVIVOR_TEAM_IDS);
const gameId    = randomUUID();
const now       = Date.now();

db.transaction(() => {
  db.prepare(`INSERT INTO partidas (id, nombre, estado, turno_actual, created_at, max_turnos, modo_ejecucion, turno_delay_ms) VALUES (?, ?, 'pendiente', 0, ?, ?, 'manual', 3000)`)
    .run(gameId, GAME_NAME, now, MAX_TURNOS);
  db.prepare(`INSERT INTO sobres (id, partida_id, sospechoso, arma, habitacion) VALUES (?, ?, ?, ?, ?)`)
    .run(randomUUID(), gameId, gameState.sobre.sospechoso, gameState.sobre.arma, gameState.sobre.habitacion);
  for (const eq of gameState.equipos) {
    db.prepare(`INSERT INTO partida_equipos (id, partida_id, equipo_id, orden, eliminado, puntos, cartas) VALUES (?, ?, ?, ?, false, 0, ?)`)
      .run(randomUUID(), gameId, eq.equipoId, eq.orden, JSON.stringify(eq.cartas));
  }
  db.prepare(`INSERT INTO tournament_round_games (id, round_id, game_id, is_bye) VALUES (?, ?, ?, false)`)
    .run(randomUUID(), ROUND_2_ID, gameId);
})();

const linked = db.prepare('SELECT trg.*, p.nombre, p.estado FROM tournament_round_games trg JOIN partidas p ON trg.game_id = p.id WHERE trg.round_id = ?').all(ROUND_2_ID);
console.log('\n✔ Fixed. Round 2 (final) games:');
for (const g of linked) console.log(`  game_id=${g.game_id}  name="${g.nombre}"  estado=${g.estado}`);

const teamRows = db.prepare(`SELECT pe.equipo_id, e.nombre, pe.orden, json_array_length(pe.cartas) as num_cartas FROM partida_equipos pe JOIN equipos e ON pe.equipo_id = e.id WHERE pe.partida_id = ? ORDER BY pe.orden`).all(gameId);
console.log('\n  Enrolled teams:');
for (const t of teamRows) console.log(`    [${t.orden}] ${t.nombre} (${t.equipo_id}) — ${t.num_cartas} cards`);
console.log(`\n  Solution: ${gameState.sobre.sospechoso} | ${gameState.sobre.arma} | ${gameState.sobre.habitacion}`);
console.log('\nDone. Copa 2 final round is now consistent.');
db.close();
