// src/lib/ws/server.ts
// NOTE: Solo puede importarse en código Node.js (server.ts).
// NO importar en Edge runtime ni Client Components.
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { parse } from 'url';
import { gameEventEmitter } from './GameEventEmitter';
import { notificationEmitter } from './NotificationEmitter';
import type { GlobalNotificationEvent, TeamNotificationEvent } from './NotificationEmitter';
import { ClientMessageSchema, type ServerMessage, type GameStateEvent } from './protocol';
import type { TurnMicroEvent } from './GameEventEmitter';
import { validateWsSession } from './auth';

// Map gameId → Set de WebSockets suscritos
const subscriptions = new Map<string, Set<WebSocket>>();
// Map gameId → unsubscribe function desde GameEventEmitter (game events)
const gameListeners = new Map<string, () => void>();
// Map gameId → unsubscribe function desde GameEventEmitter (turn micro-events, F016)
const microListeners = new Map<string, () => void>();
// Map userId → número de conexiones activas (rate limiting por sesión)
const connectionsByUser = new Map<string, number>();

// ── F018: Notification subscriptions ─────────────────────────────────────────
// Map WebSocket → { global, equipoId }
const notifSubscriptions = new Map<WebSocket, { global: boolean; equipoId: string | null }>();
// Shared global notification listener (one for all global subscribers)
let globalNotifListener: (() => void) | null = null;
// Per-equipo notification listeners
const teamNotifListeners = new Map<string, () => void>();

function ensureGlobalNotifListener() {
  if (globalNotifListener) return;
  globalNotifListener = notificationEmitter.onGlobal((event: GlobalNotificationEvent) => {
    for (const [ws, scope] of notifSubscriptions) {
      if (scope.global && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  });
}

function ensureTeamNotifListener(equipoId: string) {
  if (teamNotifListeners.has(equipoId)) return;
  const unsub = notificationEmitter.onTeam(equipoId, (event: TeamNotificationEvent) => {
    for (const [ws, scope] of notifSubscriptions) {
      if (scope.equipoId === equipoId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  });
  teamNotifListeners.set(equipoId, unsub);
}

function cleanupTeamNotifListener(equipoId: string) {
  // Remove the listener only when no active subscriber needs it anymore
  for (const scope of notifSubscriptions.values()) {
    if (scope.equipoId === equipoId) return; // still in use
  }
  const unsub = teamNotifListeners.get(equipoId);
  if (unsub) {
    unsub();
    teamNotifListeners.delete(equipoId);
  }
}

const MAX_CONNECTIONS_PER_SESSION = Number(process.env.WS_MAX_CONNECTIONS_PER_SESSION ?? 5);
const HEARTBEAT_INTERVAL_MS = Number(process.env.WS_HEARTBEAT_INTERVAL_MS ?? 30_000);
const SUBSCRIBE_TIMEOUT_MS = 3_000;

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(gameId: string, message: ServerMessage) {
  const subs = subscriptions.get(gameId);
  if (!subs) return;
  const payload = JSON.stringify(message);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

function ensureGameListener(gameId: string) {
  if (gameListeners.has(gameId)) return;
  const unsubscribe = gameEventEmitter.onGameUpdate(gameId, (event: GameStateEvent) => {
    broadcastGameEvent(gameId, event);
  });
  gameListeners.set(gameId, unsubscribe);

  // F016: also set up micro-event listener if not already registered
  if (!microListeners.has(gameId)) {
    const unsubMicro = gameEventEmitter.onTurnMicroEvent(gameId, (event: TurnMicroEvent) => {
      broadcastTurnMicroEvent(gameId, event);
    });
    microListeners.set(gameId, unsubMicro);
  }
}

function cleanupGameListener(gameId: string) {
  const subs = subscriptions.get(gameId);
  if (subs && subs.size > 0) return; // aún hay suscriptores
  const unsubscribe = gameListeners.get(gameId);
  if (unsubscribe) {
    unsubscribe();
    gameListeners.delete(gameId);
  }
  // F016: also clean up micro-event listener
  const unsubMicro = microListeners.get(gameId);
  if (unsubMicro) {
    unsubMicro();
    microListeners.delete(gameId);
  }
  if (!subs || subs.size === 0) {
    subscriptions.delete(gameId);
  }
}

function broadcastGameEvent(gameId: string, event: GameStateEvent) {
  if (event.type === 'turn_completed') {
    const p = event.payload as {
      turnoNumero: number;
      equipoId: string;
      resultadoTipo: 'sugerencia' | 'acusacion_correcta' | 'acusacion_incorrecta' | 'pase';
      nextEquipoId?: string | null;
    };
    broadcast(gameId, {
      type: 'game:turn_completed',
      gameId,
      turnoNumero: p.turnoNumero,
      equipoId: p.equipoId,
      resultadoTipo: p.resultadoTipo,
      nextEquipoId: p.nextEquipoId ?? null,
      ts: Date.now(),
    });
  } else if (event.type === 'status_changed') {
    const p = event.payload as { nuevoEstado: 'pendiente' | 'en_curso' | 'pausada' | 'finalizada' };
    broadcast(gameId, {
      type: 'game:status_changed',
      gameId,
      nuevoEstado: p.nuevoEstado,
      ts: Date.now(),
    });
  }
}

// ── F016: broadcast turn micro-events ───────────────────────────────────────
function broadcastTurnMicroEvent(gameId: string, event: TurnMicroEvent) {
  // Re-use the same type literal as the WS protocol — they match 1:1
  broadcast(gameId, { ...event, ts: event.ts ?? Date.now() } as ServerMessage);
}

export function attachWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true });

  // Interceptar upgrades hacia /api/ws
  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const { pathname } = parse(req.url ?? '');
    if (pathname !== '/api/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    // La arena es pública: permitimos conexiones anónimas para suscribirse
    // al estado de una partida, pero mantenemos protegidas las
    // notificaciones privadas de equipo.
    const session = await validateWsSession(req);
    const userId = session?.user.id ?? `anon:${req.socket.remoteAddress ?? 'unknown'}`;

    // Rate limiting: max conexiones por sesión
    const currentConns = connectionsByUser.get(userId) ?? 0;
    if (currentConns >= MAX_CONNECTIONS_PER_SESSION) {
      send(ws, { type: 'error', code: 'TOO_MANY_CONNECTIONS', message: 'Demasiadas conexiones activas' });
      ws.close(4002, 'Too many connections');
      return;
    }
    connectionsByUser.set(userId, currentConns + 1);

    let subscribedGameId: string | null = null;

    // Timeout: cerrar si no llega 'subscribe' en 3 s
    const subscribeTimeout = setTimeout(() => {
      if (!subscribedGameId) {
        send(ws, { type: 'error', code: 'SUBSCRIBE_TIMEOUT', message: 'No se recibió suscripción a tiempo' });
        ws.close(4003, 'Subscribe timeout');
      }
    }, SUBSCRIBE_TIMEOUT_MS);

    // Heartbeat: ping cada HEARTBEAT_INTERVAL_MS, cierra si no responde
    let isAlive = true;
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      send(ws, { type: 'ping', ts: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);

    // Rate limiting de mensajes: max 10/s por conexión
    let msgCount = 0;
    const msgRateReset = setInterval(() => { msgCount = 0; }, 1_000);

    ws.on('message', (raw) => {
      msgCount++;
      if (msgCount > 10) return; // ignorar flood

      try {
        const msg = ClientMessageSchema.parse(JSON.parse(raw.toString()));

        if (msg.type === 'pong') {
          isAlive = true;
          return;
        }

        if (msg.type === 'subscribe') {
          clearTimeout(subscribeTimeout);

          // Desuscribir de partida anterior
          if (subscribedGameId) {
            subscriptions.get(subscribedGameId)?.delete(ws);
            cleanupGameListener(subscribedGameId);
          }

          subscribedGameId = msg.gameId;
          if (!subscriptions.has(msg.gameId)) subscriptions.set(msg.gameId, new Set());
          subscriptions.get(msg.gameId)!.add(ws);

          // Registrar listener en GameEventEmitter para este gameId si no existe
          ensureGameListener(msg.gameId);

          send(ws, { type: 'subscribed', gameId: msg.gameId });
          return;
        }

        if (msg.type === 'subscribe:notifications') {
          clearTimeout(subscribeTimeout);
          const { scope } = msg;
          const equipoId = typeof scope === 'object' && 'team' in scope ? scope.team : null;

          if (!session?.user) {
            send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Sin sesión válida' });
            return;
          }

          // RBAC: si scope.team, verificar que la sesión pertenece al mismo equipo o es admin
          if (equipoId && session.user.rol !== 'admin' && session.user.equipo?.id !== equipoId) {
            send(ws, { type: 'error', code: 'FORBIDDEN', message: 'No autorizado para este equipo' });
            return;
          }

          // Reemplazar suscripción anterior si ya existía
          const prevScope = notifSubscriptions.get(ws);
          notifSubscriptions.set(ws, { global: true, equipoId });

          ensureGlobalNotifListener();
          if (equipoId) ensureTeamNotifListener(equipoId);

          // Limpiar listener del equipo anterior si ya no tiene suscriptores
          if (prevScope?.equipoId && prevScope.equipoId !== equipoId) {
            cleanupTeamNotifListener(prevScope.equipoId);
          }

          send(ws, { type: 'subscribed:notifications', scope });
          return;
        }

        if (msg.type === 'unsubscribe:notifications') {
          const prevScope = notifSubscriptions.get(ws);
          notifSubscriptions.delete(ws);
          if (prevScope?.equipoId) cleanupTeamNotifListener(prevScope.equipoId);
          return;
        }
      } catch {
        send(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Mensaje inválido' });
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      clearInterval(msgRateReset);
      clearTimeout(subscribeTimeout);

      // Decrementar contador de conexiones por usuario
      const conns = connectionsByUser.get(userId) ?? 1;
      if (conns <= 1) connectionsByUser.delete(userId);
      else connectionsByUser.set(userId, conns - 1);

      if (subscribedGameId) {
        subscriptions.get(subscribedGameId)?.delete(ws);
        cleanupGameListener(subscribedGameId);
      }

      // Limpiar suscripción de notificaciones
      const prevNotifScope = notifSubscriptions.get(ws);
      notifSubscriptions.delete(ws);
      if (prevNotifScope?.equipoId) cleanupTeamNotifListener(prevNotifScope.equipoId);
    });
  });
}
