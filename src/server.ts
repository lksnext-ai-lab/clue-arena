// src/server.ts — Servidor HTTP custom para Next.js + WebSocket
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { attachWebSocketServer } from '@/lib/ws/server';
// Importar gameRunner como efecto lateral: crea el singleton en globalThis antes
// de que los bundles webpack de los Route Handlers arranquen. Así el loop de
// auto-ejecución vive en el proceso de servidor, no en el contexto de petición.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { gameRunner } from '@/lib/game/runner';
import { db } from '@/lib/db';
import { partidas } from '@/lib/db/schema';
import { isNotNull, eq } from 'drizzle-orm';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

/**
 * Startup recovery: reset games that have a stale autoRunActivoDesde lock
 * left from a previous process crash.  The auto-run loop is gone, so mark
 * these games as 'pausado' so the admin can resume or advance manually.
 */
async function recoverStaleAutoRun() {
  try {
    const staleGames = await db
      .select({ id: partidas.id, nombre: partidas.nombre })
      .from(partidas)
      .where(isNotNull(partidas.autoRunActivoDesde))
      .all();

    if (staleGames.length === 0) return;

    for (const g of staleGames) {
      await db
        .update(partidas)
        .set({ modoEjecucion: 'pausado', autoRunActivoDesde: null })
        .where(eq(partidas.id, g.id));
    }

    console.warn(
      `> [recovery] ${staleGames.length} partida(s) con auto-run activo recuperadas → 'pausado': ` +
        staleGames.map((g) => g.nombre).join(', '),
    );
  } catch (err) {
    console.error('> [recovery] Error al recuperar partidas con auto-run activo:', err);
  }
}

app.prepare().then(async () => {
  await recoverStaleAutoRun();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  attachWebSocketServer(httpServer);

  const port = Number(process.env.PORT ?? 3000);
  httpServer.listen(port, () => {
    console.log(`> Clue Arena listo en http://localhost:${port}`);
  });
});
