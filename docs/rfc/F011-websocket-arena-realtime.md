# RFC F011 — WebSocket: Actualización en Tiempo Real del Panel de Partida

| Campo | Valor |
|---|---|
| **ID** | F011 |
| **Título** | WebSocket: reemplazo del polling en la Arena por actualización en tiempo real |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-27 |
| **Refs. spec** | [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) · [70-frontend](../../clue-arena-spec/docs/spec/70-frontend.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [11-requisitos-tecnicos-nfr](../../clue-arena-spec/docs/spec/11-requisitos-tecnicos-nfr.md) |
| **Deps.** | RFC F001 · RFC F007 · RFC F009 |

---

## 1. Resumen

Este RFC diseña la sustitución del mecanismo de **polling HTTP cada 5 s** del panel de partida activa (`/partidas/[id]` y `/arena`) por una conexión **WebSocket** persistente. El objetivo es que la UI refleje cada cambio de estado de la partida —turno completado, equipo eliminado, acusación, finalización— **en el momento en que se produce**, sin latencia artificial ni carga innecesaria.

El diseño introduce:

1. Un **servidor WebSocket** embebido en el proceso Next.js mediante un servidor custom (`server.ts`) y la librería `ws`.
2. Un **`GameEventEmitter`** (EventEmitter Node.js singleton) que conecta la capa de ejecución del motor de juego con el servidor WebSocket sin acoplamientos directos.
3. Una evolución de **`GameContext`** que reemplaza `useInterval` por la gestión del ciclo de vida de la conexión WebSocket (connect, reconnect, heartbeat, close).
4. Un **protocolo de mensajes** versionado y tipado con Zod para serializar estados de partida y eventos de control.

---

## 2. Motivación

### 2.1 Problema del polling actual

`GameContext` implementa un `useInterval` de 5 s sobre `GET /api/games/:id`:

```
UI ─── every 5 s ──▶ GET /api/games/:id ──▶ DB full read ──▶ JSON response
```

| Limitación | Impacto |
|---|---|
| Latencia máxima 5 s entre evento y reflejo en UI | Experiencia de espectador degradada, especialmente en finales |
| Cada llamada serializa la partida completa (~10–30 kB según turnos) | Carga innecesaria cuando no hay cambios |
| N clientes × 1 req/5 s → carga creciente con espectadores | Escabilidad limitada durante el evento (≈100 espectadores esperados) |
| Sin distinción entre "actualización" y "sin cambios" | El cliente re-renderiza aunque el estado no haya variado |
| El polling se detiene solo cuando `estado === 'finalizada'`; no hay notificación proactiva | El cliente puede perderse el evento de finalización si el poll coincide mal |

### 2.2 Objetivo tras este RFC

```
Motor ──▶ GameEventEmitter ──▶ WS Server ──▶ broadcast ──▶ N clientes suscritos
         (event emitido al                   (solo cuando
          completar turno)                    hay cambio)
```

- Latencia evento → UI: **< 200 ms** en condiciones normales de red local.
- Cero llamadas HTTP periódicas durante la partida.
- El cliente recibe solo el delta necesario (evento tipado) en lugar del objeto completo en cada poll.
- Reconexión automática con rehydratación de estado para llegar tarde o recuperarse de desconexiones.

---

## 3. Decisiones de diseño

### 3.1 WebSocket vs. Server-Sent Events (SSE)

| Criterio | WebSocket (`ws`) | SSE (`EventSource`) |
|---|---|---|
| Bidireccionalidad | Sí | No (server → client only) |
| Complejidad servidor | Alta (custom server) | Baja (Route Handler nativo) |
| Reconexión automática | Manual (client) | Nativa en el navegador |
| Soporte de proxies/load balancer | Variable (requiere `Upgrade`) | Siempre funciona sobre HTTP |
| Autenticación en handshake | Header custom dificultoso; token en query param | Cookie o header bearer normal |
| Necesidad de envío client → server | Solo `ping`/`subscribe` mínimos | Ninguna |
| Integración Next.js 15 App Router | Requiere custom server | Route Handler nativo |

La comunicación de la arena es **unidireccional** (server → client). SSE cubriría el caso de uso sin necesidad de custom server.

**Decisión**: se diseña con **WebSocket** (`ws`) sobre servidor custom para mayor flexibilidad futura (posibilidad de mensajes client→server en próximas iteraciones, p.ej. "solicitar replay"). Sin embargo, la implementación está diseñada para que la migración a SSE sea trivial si el custom server añade fricción operativa. Ver §8 (alternativa SSE).

> **ADR pendiente**: formalizar la elección WebSocket vs. SSE en `docs/rfc/` o `docs/adr/`.

### 3.2 Custom server vs. Route Handler

Next.js 15 con App Router no soporta WebSockets nativos en Route Handlers (el protocolo `Upgrade` no está expuesto vía la API de Route Handlers). La única vía oficial es un **servidor HTTP custom** que intercepte los requests de upgrade antes de delegarlos a Next.js.

Estructura resultante:

```
Node.js process
├── HTTP Server (custom)
│   ├── /api/ws  ←── upgrade → WebSocket Server (ws)
│   └── /*       ──── forward → Next.js request handler
└── Next.js App Router (en memoria, no escucha en puerto)
```

### 3.3 Transporte de autenticación

El handshake WebSocket no permite cabeceras custom en navegadores. Opciones:

1. **Query param `?token=<jwt>`**: fácil pero el token queda en logs del servidor.
2. **Cookie `httpOnly`**: Auth.js ya usa cookie de sesión httpOnly; el upgrade la envía automáticamente.
3. **Mensaje `auth` post-connect**: el cliente envía el token como primer mensaje tras conectar; el servidor cierra si no llega en < 2 s.

**Decisión**: opción 2 (cookie de sesión Auth.js) como mecanismo primario. En `DISABLE_AUTH=true` se acepta sin comprobación. No se expone token sensible en URL.

---

## 4. Arquitectura del servidor

### 4.1 Árbol de ficheros nuevos / modificados

```
src/
├── server.ts                          ← NUEVO  custom HTTP server
├── lib/
│   ├── ws/
│   │   ├── server.ts                  ← NUEVO  WebSocket server singleton
│   │   ├── GameEventEmitter.ts        ← NUEVO  EventEmitter singleton
│   │   ├── protocol.ts                ← NUEVO  tipos y schemas Zod del protocolo
│   │   └── auth.ts                    ← NUEVO  validación de sesión en WS
│   └── game/
│       └── coordinator.ts             ← MODIFICADO  emite eventos tras cada turno
├── contexts/
│   └── GameContext.tsx                ← MODIFICADO  useInterval → useGameSocket
├── lib/utils/
│   └── useGameSocket.ts               ← NUEVO  hook de ciclo de vida WS
package.json                           ← MODIFICADO  script dev/start con server.ts
```

### 4.2 `src/server.ts` — servidor custom

```typescript
// src/server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { attachWebSocketServer } from '@/lib/ws/server';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  attachWebSocketServer(httpServer);

  httpServer.listen(3000, () => {
    console.log(`> Clue Arena listo en http://localhost:3000`);
  });
});
```

Scripts en `package.json`:

```json
{
  "scripts": {
    "dev":   "tsx src/server.ts",
    "start": "NODE_ENV=production tsx src/server.ts"
  }
}
```

### 4.3 `src/lib/ws/GameEventEmitter.ts` — EventEmitter singleton

```typescript
// src/lib/ws/GameEventEmitter.ts
import { EventEmitter } from 'events';
import type { GameStateEvent } from './protocol';

class GameEventEmitter extends EventEmitter {
  emitTurnCompleted(gameId: string, payload: GameStateEvent) {
    this.emit(`game:${gameId}`, payload);
  }
  onGameUpdate(gameId: string, listener: (event: GameStateEvent) => void) {
    this.on(`game:${gameId}`, listener);
    return () => this.off(`game:${gameId}`, listener);
  }
}

// Singleton dentro del proceso Node.js
const gameEventEmitter = new GameEventEmitter();
gameEventEmitter.setMaxListeners(200); // ~200 clientes concurrentes esperados

export { gameEventEmitter };
```

> **Importante**: este módulo **solo puede importarse en código Node.js** (Route Handlers, `server.ts`, `coordinator.ts`). NO importar en Client Components ni Edge runtime.

### 4.4 `src/lib/ws/protocol.ts` — protocolo de mensajes

```typescript
// src/lib/ws/protocol.ts
import { z } from 'zod';

/** Mensajes server → client */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  // Estado completo de la partida (enviado al suscribirse o al reconectar)
  z.object({
    type: z.literal('game:state'),
    gameId: z.string(),
    payload: z.unknown(), // GameDetailResponse serializado
    ts: z.number(),
  }),
  // Delta: turno completado
  z.object({
    type: z.literal('game:turn_completed'),
    gameId: z.string(),
    turnoNumero: z.number(),
    equipoId: z.string(),
    resultadoTipo: z.enum(['sugerencia', 'acusacion_correcta', 'acusacion_incorrecta']),
    ts: z.number(),
  }),
  // Cambio de estado de la partida
  z.object({
    type: z.literal('game:status_changed'),
    gameId: z.string(),
    nuevoEstado: z.enum(['pendiente', 'en_curso', 'pausada', 'finalizada']),
    ts: z.number(),
  }),
  // Heartbeat para mantener la conexión
  z.object({ type: z.literal('ping'), ts: z.number() }),
  // Confirmación de suscripción
  z.object({ type: z.literal('subscribed'), gameId: z.string() }),
  // Error
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

/** Mensajes client → server */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  // El cliente se suscribe a una partida
  z.object({ type: z.literal('subscribe'), gameId: z.string() }),
  // El cliente responde al heartbeat
  z.object({ type: z.literal('pong') }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Evento interno que fluye por GameEventEmitter
export interface GameStateEvent {
  type: 'turn_completed' | 'status_changed' | 'state_snapshot';
  gameId: string;
  payload: unknown;
}
```

### 4.5 `src/lib/ws/server.ts` — servidor WebSocket

```typescript
// src/lib/ws/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { parse } from 'url';
import { gameEventEmitter } from './GameEventEmitter';
import { ClientMessageSchema, type ServerMessage } from './protocol';
import { validateWsSession } from './auth';

// Map gameId → Set de WebSockets suscritos
const subscriptions = new Map<string, Set<WebSocket>>();

function broadcast(gameId: string, message: ServerMessage) {
  const subs = subscriptions.get(gameId);
  if (!subs) return;
  const payload = JSON.stringify(message);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
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
    // Validar sesión por cookie
    const session = await validateWsSession(req);
    if (!session) {
      ws.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED', message: 'Sin sesión válida' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    let subscribedGameId: string | null = null;

    // Heartbeat: ping cada 30 s, cierra si no responde en 10 s
    let isAlive = true;
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) { ws.terminate(); return; }
      isAlive = false;
      ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
    }, 30_000);

    ws.on('message', (raw) => {
      try {
        const msg = ClientMessageSchema.parse(JSON.parse(raw.toString()));

        if (msg.type === 'pong') {
          isAlive = true;
          return;
        }

        if (msg.type === 'subscribe') {
          // Desuscribir de partida anterior
          if (subscribedGameId) {
            subscriptions.get(subscribedGameId)?.delete(ws);
          }
          subscribedGameId = msg.gameId;
          if (!subscriptions.has(msg.gameId)) subscriptions.set(msg.gameId, new Set());
          subscriptions.get(msg.gameId)!.add(ws);
          ws.send(JSON.stringify({ type: 'subscribed', gameId: msg.gameId }));
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE', message: 'Mensaje inválido' }));
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      if (subscribedGameId) subscriptions.get(subscribedGameId)?.delete(ws);
    });
  });

  // Escuchar eventos del motor de juego y hacer broadcast
  gameEventEmitter.on('game:*', (event) => {
    if (!event?.gameId) return;
    broadcast(event.gameId, {
      type: event.type === 'turn_completed' ? 'game:turn_completed' : 'game:status_changed',
      gameId: event.gameId,
      ...event.payload,
      ts: Date.now(),
    } as any);
  });
}
```

> **Nota**: el evento global `game:*` requiere activar `wildcards` en el EventEmitter o usar una suscripción por evento. En la implementación real, el `GameEventEmitter` expondrá métodos tipados (`onGameUpdate`) en lugar de usar wildcards.

### 4.6 Integración en `coordinator.ts`

Tras persistir cada turno o cambio de estado, el coordinador llama al `GameEventEmitter`:

```typescript
// Ejemplo en src/lib/game/coordinator.ts (fragmento del flujo de turno)
import { gameEventEmitter } from '@/lib/ws/GameEventEmitter';

// ... tras applyAction + persistencia ...

// Emitir estado actualizado a los clientes suscritos
gameEventEmitter.emitTurnCompleted(gameId, {
  type: 'turn_completed',
  gameId,
  payload: {
    turnoNumero: newState.turnoActual,
    equipoId: turno.equipoId,
    resultadoTipo: resultado,
  },
});

// Si la partida ha finalizado, emitir cambio de estado
if (isGameOver(newState)) {
  gameEventEmitter.emitTurnCompleted(gameId, {
    type: 'status_changed',
    gameId,
    payload: { nuevoEstado: 'finalizada' },
  });
}
```

---

## 5. Arquitectura del cliente

### 5.1 `src/lib/utils/useGameSocket.ts` — hook de ciclo de vida

```typescript
// src/lib/utils/useGameSocket.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage } from '@/lib/ws/protocol';

interface UseGameSocketOptions {
  gameId: string;
  onMessage: (msg: ServerMessage) => void;
  enabled: boolean; // false cuando la partida está finalizada
}

// La URL se resuelve en tiempo de ejecución; `NEXT_PUBLIC_WS_URL`
// puede sobrescribirla en build, pero si no existe se construye a partir
// de `window.location` para evitar que el bundle quede con
// `localhost:3000` incrustado.
function getWsUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/api/ws`;
  }
  return 'ws://localhost:3000/api/ws';
}

const RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useGameSocket({ gameId, onMessage, enabled }: UseGameSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      ws.send(JSON.stringify({ type: 'subscribe', gameId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        // Responder al ping automáticamente
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        onMessage(msg);
      } catch {
        console.warn('[WS] Mensaje no parseable', event.data);
      }
    };

    ws.onclose = (event) => {
      if (!enabled) return;
      if (event.code === 4001) return; // No reconectar si fue por auth
      if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WS] Máximo de reconexiones alcanzado.');
        return;
      }
      const delay = RECONNECT_DELAY_MS * Math.min(attemptsRef.current + 1, 5);
      attemptsRef.current++;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [gameId, enabled, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'Component unmounted');
    };
  }, [connect]);
}
```

### 5.2 `GameContext.tsx` — migración de polling a WebSocket

```typescript
// src/contexts/GameContext.tsx (versión WebSocket)
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useGameSocket } from '@/lib/utils/useGameSocket';
import { apiFetch } from '@/lib/api/client';
import type { GameDetailResponse } from '@/types/api';
import type { ServerMessage } from '@/lib/ws/protocol';

interface GameContextValue {
  partida: GameDetailResponse | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  error: Error | null;
  refresh: () => void; // fallback HTTP manual
}

// ... Provider ...

export function GameProvider({ children, gameId }: Omit<GameProviderProps, 'pollingInterval'>) {
  const [partida, setPartida] = useState<GameDetailResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isFinished = partida?.estado === 'finalizada';

  // Fetching HTTP: solo al montar (estado inicial) y como fallback manual
  const fetchGame = useCallback(async () => {
    try {
      const data = await apiFetch<GameDetailResponse>(`/games/${gameId}`);
      setPartida(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    }
  }, [gameId]);

  // Carga inicial
  React.useEffect(() => { fetchGame(); }, [fetchGame]);

  // Manejador de mensajes WebSocket
  const handleWsMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === 'subscribed') {
      setIsConnected(true);
      // Re-fetch completo al suscribirse para garantizar estado fresco
      fetchGame();
      return;
    }
    if (msg.type === 'game:turn_completed' || msg.type === 'game:status_changed') {
      // Re-fetch completo del estado actual (simple y robusto)
      // OPENQ: evaluar enviar delta completo en el evento para evitar even este fetch
      fetchGame();
    }
  }, [fetchGame]);

  // WebSocket: activo mientras la partida no ha finalizado
  useGameSocket({
    gameId,
    onMessage: handleWsMessage,
    enabled: !isFinished,
  });

  return (
    <GameContext.Provider value={{ partida, isConnected, lastUpdated, error, refresh: fetchGame }}>
      {children}
    </GameContext.Provider>
  );
}
```

> **Nota sobre re-fetch**: al recibir un evento WS, el cliente hace un `GET /api/games/:id` completo en lugar de aplicar el delta directamente. Esto simplifica la gestión de estado en MVP y garantiza consistencia. La optimización de enviar el estado completo dentro del mensaje WS se deja como mejora futura (OPENQ-WS-001).

---

## 6. Diagrama de flujo

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Next.js Process                                 │
│                                                                          │
│  ┌─────────────────┐   applyAction   ┌──────────────────────────────┐   │
│  │  /api/games/:id │ ──────────────▶ │  coordinator.ts              │   │
│  │  /advance-turn  │                 │  1. applyAction(state,action) │   │
│  └─────────────────┘                 │  2. db persist               │   │
│                                      │  3. emitTurnCompleted()       │   │
│                                      └──────────────┬───────────────┘   │
│                                                     │                   │
│                                                     ▼                   │
│                                      ┌──────────────────────────────┐   │
│                                      │  GameEventEmitter (singleton) │   │
│                                      │  emit('game:{id}', event)     │   │
│                                      └──────────────┬───────────────┘   │
│                                                     │                   │
│                                                     ▼                   │
│                                      ┌──────────────────────────────┐   │
│                                      │  WebSocket Server (ws)        │   │
│                                      │  broadcast to subs[gameId]   │   │
│                                      └──────┬────────────────────────┘   │
│                                             │                           │
└─────────────────────────────────────────────│───────────────────────────┘
                                              │  WebSocket frame
                                   ┌──────────┴──────────┐
                              ┌────▼────┐          ┌─────▼────┐
                              │ Browser │          │ Browser  │
                              │   A     │          │    B     │
                              └─────────┘          └──────────┘
                              GameContext           GameContext
                              onmessage             onmessage
                              → fetchGame()         → fetchGame()
```

---

## 7. Seguridad

### 7.1 Autenticación del WebSocket

```typescript
// src/lib/ws/auth.ts
import { parse as parseCookies } from 'cookie';
import type { IncomingMessage } from 'http';
import { auth } from '@/lib/auth/config';

export async function validateWsSession(req: IncomingMessage) {
  // Auth.js lee la cookie de sesión del IncomingMessage
  // @ts-expect-error NextRequest cast necesario para auth()
  const session = await auth(req as any);
  return session ?? null;
}
```

### 7.2 Controles adicionales

| Control | Implementación |
|---|---|
| Autenticación | Cookie de sesión Auth.js (`authjs.session-token`) validada en cada handshake |
| Autorización por rol | Todo usuario autenticado puede suscribirse a `/api/ws`; la visibilidad de `cartaMostrada` se filtra en `GET /api/games/:id`, no en el WS |
| Rate limiting de conexiones | Máx. 5 conexiones simultáneas por sesión (contador en memoria) |
| Timeout de handshake | Cerrar conexión si no llega `subscribe` en 3 s |
| Flood de mensajes | Ignorar mensajes adicionales si el cliente ya está suscrito; max 10 msg/s por WS |
| Cierre de código 4001 | No reconectar en cliente; reservado para errores de auth |
| `setMaxListeners(200)` en GameEventEmitter | Evitar warning de Node.js con muchos espectadores |

### 7.3 Datos sensibles

El servidor WebSocket **no envía datos de partida** directamente en los eventos. Solo envía notificaciones de cambio (tipo de evento + `gameId` + `turnoNumero`). El estado completo se obtiene mediante `GET /api/games/:id`, que ya aplica los filtros de visibilidad por rol (`cartaMostrada`).

---

## 8. Alternativa SSE (fallback)

Si el servidor custom introduce fricción operativa (p.ej. incompatibilidad con el entorno de hosting), la arquitectura puede migrarse a **Server-Sent Events** con cambios mínimos:

| Componente | Cambio |
|---|---|
| `src/server.ts` | Se elimina; vuelve a `next dev`/`next start` estándar |
| `src/app/api/games/[id]/stream/route.ts` | NUEVO Route Handler con `ReadableStream` y `text/event-stream` |
| `src/lib/utils/useGameSocket.ts` | Renombrar a `useGameStream.ts`; reemplazar `WebSocket` por `EventSource` |
| `GameEventEmitter` | Sin cambios; sigue siendo el bus de eventos interno |
| `protocol.ts` | Sin cambios en tipos; se serializa como SSE en lugar de WS frame |

```typescript
// src/app/api/games/[id]/stream/route.ts (boceto SSE)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = await params;
  // Autenticación por sesión...

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = gameEventEmitter.onGameUpdate(gameId, (event) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      });
      // Limpiar al cerrar
      return () => unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## 9. Plan de migración

### 9.1 Fases

| Fase | Tarea | Criterio de done |
|---|---|---|
| 1 | Instalar `ws` y `tsx`; crear `src/server.ts`; adaptar scripts `package.json` | `pnpm dev` arranca sin errores; rutas Next.js funcionan igual |
| 2 | Implementar `GameEventEmitter`, `protocol.ts` y `src/lib/ws/auth.ts` | Tests unitarios de protocol schemas pasan |
| 3 | Implementar `src/lib/ws/server.ts` con attach al servidor HTTP | Conexión desde `wscat` a `ws://localhost:3000/api/ws` funciona; `subscribe` devuelve `subscribed` |
| 4 | Integrar emit en `coordinator.ts` | Al avanzar turno manualmente, el cliente WS conectado recibe `game:turn_completed` |
| 5 | Implementar `useGameSocket.ts`; migrar `GameContext.tsx` | Arena actualiza sin polling; polling desactivado (eliminar `useInterval` de GameContext) |
| 6 | Actualizar `GameProvider` props (eliminar `pollingInterval`) | Compilación sin errores de tipos; ajustar llamadas en `/arena`, `/partidas/[id]`, `/admin/partidas/[id]` |
| 7 | Tests E2E Playwright: `e2e/ws-arena.spec.ts` | Test de espectador verifica que la UI actualiza tras avanzar turno sin reload |
| 8 | Revisar `pollingInterval` en lugares de la app que lo usen fuera del contexto de partida | Sin regresiones en otras vistas |

### 9.2 Compatibilidad hacia atrás

Durante la migración, `GameContext` puede mantener `useInterval` como **fallback**: si el WebSocket no conecta en 5 s, activar polling degradado. Esto se elimina en la fase final.

```typescript
// Fallback temporal en GameContext durante migración
const [wsHealthy, setWsHealthy] = useState(false);
useInterval(fetchGame, wsHealthy ? null : 5_000); // Desactiva si WS está sano
```

---

## 10. Testing

| Tipo | Fichero | Qué cubre |
|---|---|---|
| Unitario | `src/tests/ws-protocol.test.ts` | Validación Zod de schemas `ServerMessage` / `ClientMessage` |
| Unitario | `src/tests/GameEventEmitter.test.ts` | emit → subscripción → recepción; cleanup de listeners |
| Unitario | `src/tests/useGameSocket.test.ts` | Reconexión automática; envío de `subscribe`; manejo de ping/pong |
| Integración | `src/tests/ws-server.test.ts` | Servidor WS embebido: handshake, auth, broadcast, cierre |
| E2E | `e2e/ws-arena.spec.ts` | Espectador abre arena; admin avanza turno; feed actualiza sin recarga |

---

## 11. Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | URL del WebSocket usada en el cliente; si no se define se construye dinámicamente a partir de `window.location` (fallback `ws://localhost:3000/api/ws` en dev) | — |
| `WS_HEARTBEAT_INTERVAL_MS` | Intervalo de ping en ms (servidor) | `30000` |
| `WS_MAX_CONNECTIONS_PER_SESSION` | Máx. conexiones simultáneas por sesión | `5` |
| `DISABLE_AUTH` | Desactiva validación de sesión en WS (desarrollo) | `false` |

---

## 12. Dependencias nuevas

| Paquete | Tipo | Motivo |
|---|---|---|
| `ws` | `dependencies` | Servidor WebSocket en Node.js |
| `@types/ws` | `devDependencies` | Tipos TypeScript para `ws` |
| `tsx` | `devDependencies` | Ejecutar `server.ts` en dev sin build previo |

---

## 13. Preguntas abiertas

| ID | Pregunta | Impacto |
|---|---|---|
| OPENQ-WS-001 | ¿Enviar el objeto `GameDetailResponse` completo dentro del evento WS para evitar el re-fetch HTTP tras cada notificación? | Reduce una llamada HTTP por turno; añade más datos al frame WS; puede exponer datos sensibles si no se filtra correctamente por rol en WS |
| OPENQ-WS-002 | ¿Necesita `/admin/partidas/[id]` también migrar a WebSocket o mantiene polling dado que el Admin solo la usa para monitorizar? | Consistencia vs. simplicidad |
| OPENQ-WS-003 | ¿Comportamiento esperado cuando SQLite está en proceso de escritura y llega una solicitud HTTP de re-fetch simultanea? | Posible lectura sucia en `better-sqlite3` (bloqueante); revisar transacciones |
| OPENQ-WS-004 | Entorno de despliegue: ¿soporta conexiones WebSocket persistentes? ¿Hay proxy que requiera configuración de `Upgrade`? | Condiciona la viabilidad de WebSocket vs. SSE en producción |

---

## 14. Registro de fuentes

> Este RFC se basa en el código existente del proyecto y en la documentación oficial de las librerías. No se ha accedido a fuentes externas adicionales para este diseño.

| Fuente | Fecha | Qué se extrajo |
|---|---|---|
| [Next.js Docs — Custom Server](https://nextjs.org/docs/pages/building-your-application/configuring/custom-server) | 2026-02-27 | Patrón de custom server con WebSocket |
| [ws — Node.js WebSocket library](https://github.com/websockets/ws) | 2026-02-27 | API de `WebSocketServer`, `noServer`, `handleUpgrade` |
| Código existente `src/contexts/GameContext.tsx` | 2026-02-27 | Estructura de polling actual a reemplazar |
| Código existente `src/lib/game/coordinator.ts` | 2026-02-27 | Punto de integración del emit |
