# RFC F018 — Sistema de Notificaciones WebSocket

| Campo | Valor |
|---|---|
| **ID** | F018 |
| **Título** | Sistema de notificaciones en tiempo real: eventos globales y de equipo vía WebSocket |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-03-05 |
| **Refs. spec** | [40-arquitectura](../../clue-arena-spec/docs/spec/40-arquitectura.md) · [70-frontend](../../clue-arena-spec/docs/spec/70-frontend.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) |
| **Deps.** | RFC F011 · RFC F015 · RFC F007 · RFC F008 |

---

## 1. Resumen

Este RFC define un **canal de notificaciones WebSocket** que corre sobre la misma infraestructura del servidor custom introducida por F011, añadiendo dos categorías de mensajes push dirigidos a los usuarios conectados:

1. **Notificaciones globales**: eventos del ciclo de vida de las partidas oficiales que interesan a todos los roles (`admin`, `equipo`, `espectador`). Por ejemplo: partida iniciada, partida finalizada, ranking actualizado.
2. **Notificaciones de equipo**: eventos del ciclo de vida de las partidas de entrenamiento (F015) que solo interesan al equipo propietario. Por ejemplo: entrenamiento iniciado, turno completado en entrenamiento, entrenamiento finalizado.

La solución **reutiliza** el `WebSocketServer` e infraestructura singleton de F011 (mismo proceso Node.js, mismo puerto, mismo endpoint `/api/ws`), añadiendo un nuevo tipo de suscripción `subscribe:notifications` independiente de los canales de partida `subscribe`. El cliente puede tener ambas suscripciones simultáneas en la misma conexión WebSocket.

---

## 2. Motivación

### 2.1 Problemática actual

| Situación | Impacto sin este RFC |
|---|---|
| Un equipo lanza una partida de entrenamiento desde la UI | El usuario no recibe confirmación en tiempo real de que la partida arrancó ni de cuándo finalizó; debe refrescar manualmente la página o hacer polling |
| El admin inicia una partida oficial desde el panel | Los espectadores y equipos en otras páginas (p.ej. `/ranking`) no saben que el evento ha comenzado; solo lo descubren si visitan `/arena` |
| Una partida oficial finaliza | El ranking no se actualiza en tiempo real para los clientes fuera de `/arena` |
| El entrenamiento completa un turno en background | El equipo no recibe progreso mientras espera; la UX parece bloqueada |
| El agente de un equipo falla durante el entrenamiento | El equipo no recibe ningún feedback hasta que la partida aborta y refrescan la página |

### 2.2 Objetivos

1. Eliminar la necesidad de polling o refresco manual para eventos del ciclo de vida de partidas.
2. Entregar notificaciones accionables en ≤ 500 ms desde que el evento ocurre en el servidor.
3. No duplicar la infraestructura WebSocket: reutilizar el servidor ws de F011 en el mismo proceso.
4. Garantizar que solo el equipo propietario reciba las notificaciones de entrenamiento.
5. Permitir que el cliente gestione en un único hook (`useNotifications`) tanto las notificaciones globales como las de su equipo.

---

## 3. Diseño de la arquitectura

### 3.1 Visión general

```
[Training Loop / Coordinator]
        │
        ▼
  NotificationEmitter          GameEventEmitter (F011)
  (nuevo singleton)            (sin cambios)
        │                              │
        └─────────────────┬────────────┘
                          ▼
                  WS Server (F011)
                  /api/ws (mismo endpoint)
                          │
           ┌──────────────┼─────────────────┐
           ▼              ▼                 ▼
    [cliente A]     [cliente B]       [cliente C]
    suscrito:       suscrito:         suscrito:
    global +        global            game:abc123
    team:equipo1
```

Un cliente puede tener **simultáneamente**:
- Una suscripción de notificaciones (`global` + opcionalmente `team:<equipoId>`)
- Una suscripción de partida (`subscribe { gameId }`) introducida por F011

Ambas coexisten en la misma conexión WebSocket; solo se añaden registros en mapas distintos del WS server.

### 3.2 Relación con F011

| Aspecto | F011 (Arena realtime) | F018 (Notificaciones) |
|---|---|---|
| Endpoint | `/api/ws` | `/api/ws` (mismo) |
| Suscripción client→server | `{ type: "subscribe", gameId }` | `{ type: "subscribe:notifications", scope: ... }` |
| Objetivo | Estado granular de una partida activa | Eventos de ciclo de vida (inicio/fin/progreso) |
| Audiencia | Espectadores + admin viendo una partida | Todos los usuarios autenticados |
| Scoping | Por `gameId` | Global o por `equipoId` |
| Canal en GameEventEmitter | `game:<gameId>`, `game:<gameId>:micro` | Canal nuevo en `NotificationEmitter` |

### 3.3 Autenticación

Igual que F011: la sesión Auth.js se valida en el handshake WebSocket mediante cookie `httpOnly` (función `validateWsSession` de `src/lib/ws/auth.ts`). No se requieren cambios en el mecanismo de autenticación.

Para determinar qué notificaciones de equipo recibir, el servidor extrae el `equipoId` de la sesión validada y lo compara con el scope solicitado. Un usuario solo puede suscribirse a notificaciones de su propio equipo; el admin puede suscribirse a cualquier `equipoId`.

---

## 4. Protocolo — extensiones al mensaje schema

Se añaden los siguientes mensaje tipos al `ServerMessageSchema` y `ClientMessageSchema` existentes en `src/lib/ws/protocol.ts`.

### 4.1 Nuevos mensajes client → server

```typescript
// Suscripción a notificaciones
z.object({
  type: z.literal('subscribe:notifications'),
  /**
   * 'global'        → solo notificaciones de partidas oficiales
   * { team: id }    → global + notificaciones de entrenamiento del equipo
   */
  scope: z.union([
    z.literal('global'),
    z.object({ team: z.string().uuid() }),
  ]),
}),
// Confirma cierre voluntario de la suscripción de notificaciones
z.object({ type: z.literal('unsubscribe:notifications') }),
```

### 4.2 Nuevos mensajes server → client

#### 4.2.1 Notificaciones globales (partidas oficiales)

```typescript
// Partida oficial creada/programada
z.object({
  type:    z.literal('notification:game_scheduled'),
  gameId:  z.string(),
  nombre:  z.string(),           // Nombre descriptivo para la UI
  ts:      z.number(),
}),

// Partida oficial iniciada
z.object({
  type:    z.literal('notification:game_started'),
  gameId:  z.string(),
  nombre:  z.string(),
  ts:      z.number(),
}),

// Partida oficial finalizada
z.object({
  type:         z.literal('notification:game_finished'),
  gameId:       z.string(),
  nombre:       z.string(),
  ganadorId:    z.string().nullable(),
  ganadorNombre: z.string().nullable(),
  ts:           z.number(),
}),

// Ranking actualizado (emitido tras finalizar una partida oficial)
z.object({
  type: z.literal('notification:ranking_updated'),
  ts:   z.number(),
}),
```

#### 4.2.2 Notificaciones de equipo (partidas de entrenamiento)

```typescript
// Entrenamiento iniciado
z.object({
  type:          z.literal('notification:training_started'),
  trainingGameId: z.string(),
  equipoId:      z.string(),
  numBots:       z.number(),
  ts:            z.number(),
}),

// Entrenamiento finalizado
z.object({
  type:              z.literal('notification:training_finished'),
  trainingGameId:    z.string(),
  equipoId:          z.string(),
  estado:            z.enum(['finalizada', 'abortada']),
  ganadorId:         z.string().nullable(),
  numTurnos:         z.number(),
  puntosSimulados:   z.number(),
  motivoAbort:       z.string().optional(),
  ts:                z.number(),
}),

// Error durante el entrenamiento
z.object({
  type:           z.literal('notification:training_error'),
  trainingGameId: z.string(),
  equipoId:       z.string(),
  message:        z.string(),
  ts:             z.number(),
}),
```

#### 4.2.3 Control

```typescript
// Confirmación de suscripción a notificaciones
z.object({
  type:  z.literal('subscribed:notifications'),
  scope: z.union([z.literal('global'), z.object({ team: z.string() })]),
}),
```

### 4.3 Tabla de eventos → notificaciones

Referencia completa de qué acción del sistema genera qué notificación, por qué canal y a quién llega.

| Trigger (servidor) | Tipo de notificación | Canal | Destinatarios |
|---|---|---|---|
| POST `/api/games` — partida creada | `notification:game_scheduled` | Global | `admin`, `equipo`, `espectador` |
| POST `/api/games/:id/start` — partida iniciada | `notification:game_started` | Global | `admin`, `equipo`, `espectador` |
| Coordinador (F007) — partida finaliza | `notification:game_finished` | Global | `admin`, `equipo`, `espectador` |
| Coordinador (F007) — partida finaliza | `notification:ranking_updated` | Global | `admin`, `equipo`, `espectador` |
| `training-loop.ts` — loop arranca | `notification:training_started` | Team | Solo el equipo propietario |
| `training-loop.ts` — loop termina (`finalizada` o `abortada`) | `notification:training_finished` | Team | Solo el equipo propietario |
| `training-loop.ts` — bloque `catch` del loop | `notification:training_error` | Team | Solo el equipo propietario |

> **Nota**: el admin recibe únicamente notificaciones globales. Las notificaciones de entrenamiento (`Team`) nunca se entregan a otros roles, ni siquiera al admin (ver §14 OPENQ-F018-03).

---

## 5. Implementación del servidor

### 5.1 Árbol de ficheros nuevos / modificados

```
src/
├── lib/
│   ├── ws/
│   │   ├── protocol.ts              ← MODIFICAR: añadir nuevos tipos al schema
│   │   ├── GameEventEmitter.ts      ← sin cambios
│   │   ├── NotificationEmitter.ts   ← NUEVO singleton para eventos de notificación
│   │   └── server.ts                ← MODIFICAR: registrar handler subscribe:notifications
│   └── game/
│       └── training-loop.ts         ← MODIFICAR: emitir eventos al NotificationEmitter
├── app/
│   └── api/
│       └── games/
│           └── route.ts             ← MODIFICAR: emitir notification:game_started/finished
├── components/
│   └── layout/
│       └── NotificationToast.tsx    ← NUEVO componente de UI
└── contexts/
    └── NotificationContext.tsx      ← NUEVO contexto + hook useNotifications
```

### 5.2 `NotificationEmitter` (nuevo singleton)

`src/lib/ws/NotificationEmitter.ts`

Sigue el mismo patrón singleton `globalThis` de `GameEventEmitter` para evitar duplicación de instancias entre bundles webpack de Next.js:

```typescript
import { EventEmitter } from 'events';

export type GlobalNotificationEvent =
  | { type: 'notification:game_scheduled'; gameId: string; nombre: string; ts: number }
  | { type: 'notification:game_started';   gameId: string; nombre: string; ts: number }
  | { type: 'notification:game_finished';  gameId: string; nombre: string; ganadorId: string | null; ganadorNombre: string | null; ts: number }
  | { type: 'notification:ranking_updated'; ts: number };

export type TeamNotificationEvent =
  | { type: 'notification:training_started';  trainingGameId: string; equipoId: string; numBots: number; ts: number }
  | { type: 'notification:training_finished'; trainingGameId: string; equipoId: string; estado: 'finalizada' | 'abortada'; ganadorId: string | null; numTurnos: number; puntosSimulados: number; motivoAbort?: string; ts: number }
  | { type: 'notification:training_error';    trainingGameId: string; equipoId: string; message: string; ts: number };

const GLOBAL_CHANNEL  = 'notifications:global';
const teamChannel = (equipoId: string) => `notifications:team:${equipoId}`;

class NotificationEmitter extends EventEmitter {
  // ── Global ───────────────────────────────────────────────────────────────
  emitGlobal(event: GlobalNotificationEvent) {
    this.emit(GLOBAL_CHANNEL, event);
  }
  onGlobal(listener: (event: GlobalNotificationEvent) => void) {
    this.on(GLOBAL_CHANNEL, listener);
    return () => this.off(GLOBAL_CHANNEL, listener);
  }

  // ── Team ─────────────────────────────────────────────────────────────────
  emitTeam(event: TeamNotificationEvent) {
    this.emit(teamChannel(event.equipoId), event);
  }
  onTeam(equipoId: string, listener: (event: TeamNotificationEvent) => void) {
    this.on(teamChannel(equipoId), listener);
    return () => this.off(teamChannel(equipoId), listener);
  }
}

const GLOBAL_KEY = Symbol.for('clue-arena.notificationEmitter');
type GlobalWithEmitter = typeof globalThis & { [key: symbol]: NotificationEmitter };

if (!(globalThis as GlobalWithEmitter)[GLOBAL_KEY]) {
  const emitter = new NotificationEmitter();
  emitter.setMaxListeners(300);
  (globalThis as GlobalWithEmitter)[GLOBAL_KEY] = emitter;
}

export const notificationEmitter: NotificationEmitter =
  (globalThis as GlobalWithEmitter)[GLOBAL_KEY];
```

### 5.3 Extensión del WS Server (`server.ts`)

Se añade el handler para `subscribe:notifications` en el bloque `ws.on('message', ...)` existente:

```typescript
// ── Mapa adicional: clientId → scope suscrito ────────────────────────────
const notificationSubscriptions = new Map<
  WebSocket,
  { global: boolean; equipoId: string | null }
>();
// Listener global compartido
let globalNotifListener: (() => void) | null = null;
// Listeners por equipo
const teamNotifListeners = new Map<string, () => void>();

function ensureGlobalNotifListener() {
  if (globalNotifListener) return;
  globalNotifListener = notificationEmitter.onGlobal((event) => {
    for (const [ws, scope] of notificationSubscriptions) {
      if (scope.global && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  });
}

function ensureTeamNotifListener(equipoId: string) {
  if (teamNotifListeners.has(equipoId)) return;
  const unsub = notificationEmitter.onTeam(equipoId, (event) => {
    for (const [ws, scope] of notificationSubscriptions) {
      if (scope.equipoId === equipoId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  });
  teamNotifListeners.set(equipoId, unsub);
}

// En el handler de mensajes:
case 'subscribe:notifications': {
  const { scope } = parsed.data;
  const equipoId = typeof scope === 'object' ? scope.team : null;

  // RBAC: si scope.team, verificar que la sesión corresponde
  // al mismo equipo o que el usuario es admin
  if (equipoId && session.user.role !== 'admin' && session.user.equipoId !== equipoId) {
    send(ws, { type: 'error', code: 'FORBIDDEN', message: 'No autorizado para este equipo' });
    break;
  }

  notificationSubscriptions.set(ws, { global: true, equipoId });
  ensureGlobalNotifListener();
  if (equipoId) ensureTeamNotifListener(equipoId);

  send(ws, { type: 'subscribed:notifications', scope });
  break;
}

case 'unsubscribe:notifications': {
  notificationSubscriptions.delete(ws);
  send(ws, { type: 'subscribed:notifications', scope: 'global' }); // confirmación implícita
  break;
}
```

Al cerrar la conexión (`ws.on('close')`), eliminar la entrada de `notificationSubscriptions`. El listener global y de equipo permanecen mientras haya al menos un suscriptor activo del mismo equipo.

---

## 6. Integración en el Training Loop

`training-loop.ts` importa `notificationEmitter` y emite en tres puntos del ciclo:

### 6.1 Al iniciar la partida

```typescript
// Antes de entrar al bucle principal de turnos
notificationEmitter.emitTeam({
  type: 'notification:training_started',
  trainingGameId: gameId,
  equipoId,
  numBots,
  ts: Date.now(),
});
```

### 6.2 Al finalizar o abortar la partida

```typescript
// Antes de retornar el TrainingLoopResult
notificationEmitter.emitTeam({
  type: 'notification:training_finished',
  trainingGameId: gameId,
  equipoId,
  estado: result.estado,
  ganadorId: result.ganadorId,
  numTurnos: result.numTurnos,
  puntosSimulados: result.puntosSimulados,
  motivoAbort: result.motivoAbort,
  ts: Date.now(),
});
```

### 6.4 En captura de errores `catch`

```typescript
// En el bloque catch principal del loop
notificationEmitter.emitTeam({
  type: 'notification:training_error',
  trainingGameId: gameId,
  equipoId,
  message: err instanceof Error ? err.message : 'Error desconocido',
  ts: Date.now(),
});
```

---

## 7. Integración en partidas oficiales

Las notificaciones globales se emiten desde los Route Handlers de administración de partidas (`src/app/api/games/route.ts` y acciones de partida):

| Punto de emisión | Evento emitido |
|---|---|
| POST `/api/games` — partida creada | `notification:game_scheduled` |
| POST `/api/games/:id/start` — partida iniciada | `notification:game_started` |
| Motor finaliza partida (coordinador, F007) | `notification:game_finished` + `notification:ranking_updated` |

```typescript
// Ejemplo: en el handler de inicio de partida
import { notificationEmitter } from '@/lib/ws/NotificationEmitter';

// Tras persistir el estado 'en_curso' en la BD:
notificationEmitter.emitGlobal({
  type: 'notification:game_started',
  gameId: game.id,
  nombre: game.nombre,
  ts: Date.now(),
});
```

---

## 8. Cliente — `NotificationContext` y hook `useNotifications`

### 8.1 Estructura del contexto

`src/contexts/NotificationContext.tsx`

```typescript
'use client';

export interface AppNotification {
  id:        string;           // UUID generado en cliente para gestión de estado
  type:      ServerNotificationMessage['type'];
  title:     string;           // Derivado del tipo + payload
  body:      string;
  severity:  'info' | 'success' | 'warning' | 'error';
  ts:        number;
  read:      boolean;
  payload:   ServerNotificationMessage;
}

interface NotificationContextValue {
  notifications:     AppNotification[];
  unreadCount:       number;
  markAllRead:       () => void;
  dismiss:           (id: string) => void;
  clearAll:          () => void;
}
```

El contexto gestiona:
- Una cola de notificaciones en memoria (últimas 50 — circular).
- El estado `read` de cada una.
- Persistencia opcional en `sessionStorage` para recuperar notificaciones al navegar entre páginas.

### 8.2 Conexión WebSocket y suscripción

El `NotificationContext` reutiliza **la misma conexión WebSocket** de `GameContext` si ya está abierta, a través de un `WebSocketManager` singleton de cliente (a definir en `src/lib/ws/client.ts`). Esto evita abrir dos conexiones al mismo endpoint para un mismo usuario.

Si `GameContext` no está activo (usuario fuera de `/arena`), `NotificationContext` abre su propia conexión y envía:

```json
{ "type": "subscribe:notifications", "scope": { "team": "<equipoId>" } }
```

o `"scope": "global"` si el rol es `espectador`.

### 8.3 Traducción de mensajes a `AppNotification`

```typescript
function toAppNotification(msg: ServerNotificationMessage): AppNotification {
  switch (msg.type) {
    case 'notification:game_started':
      return { ..., title: 'Partida iniciada', body: `La partida "${msg.nombre}" ha comenzado`, severity: 'info' };
    case 'notification:game_finished':
      return { ..., title: 'Partida finalizada', body: `Ganador: ${msg.ganadorNombre ?? 'Sin ganador'}`, severity: 'success' };
    case 'notification:ranking_updated':
      return { ..., title: 'Ranking actualizado', body: 'Se ha actualizado la clasificación', severity: 'info' };
    case 'notification:training_started':
      return { ..., title: 'Entrenamiento iniciado', body: `Partida de entrenamiento en curso`, severity: 'info' };
    case 'notification:training_finished':
      return { ..., title: 'Entrenamiento finalizado', body: msg.estado === 'finalizada' ? `Ganador: ${msg.ganadorId ?? 'Ninguno'} · ${msg.numTurnos} turnos` : `Abortado: ${msg.motivoAbort}`, severity: msg.estado === 'abortada' ? 'warning' : 'success' };
    case 'notification:training_error':
      return { ..., title: 'Error en entrenamiento', body: msg.message, severity: 'error' };
    // ...
  }
}
```

### 8.4 Hook de consumo

```typescript
const { notifications, unreadCount, markAllRead, dismiss } = useNotifications();
```

### 8.5 Componente `NotificationToast`

`src/components/layout/NotificationToast.tsx`

- Montado dentro de `AppShell` (disponible en toda la app).
- Muestra las últimas 3 notificaciones no leídas como toasts apilados en la esquina inferior-derecha.
- Integra con `sonner` (ya disponible vía shadcn/ui) para el renderizado del toast.

```typescript
// Ejemplo de uso en AppShell:
<NotificationToast />
```

Un icono de campana en el header muestra el `unreadCount` como badge; al hacer clic abre un `Popover` con el historial completo.

---

## 9. Consideraciones de seguridad

| Riesgo | Mitigación |
|---|---|
| Un usuario solicita notificaciones de equipo ajeno | El WS server verifica `session.user.equipoId === scope.team` (o `role === 'admin'`) antes de registrar la suscripción |
| Flooding de `subscribe:notifications` | Rate limiting existente `MAX_CONNECTIONS_PER_SESSION` cubre la conexión; adicionalmente, una segunda llamada a `subscribe:notifications` en la misma conexión reemplaza la suscripción anterior (sin acumulación) |
| El NotificationEmitter acumula listeners indefinidamente | Los listeners de equipo se eliminan cuando el conjunto de suscriptores WS del equipo queda vacío (mismo patrón que `cleanupGameListener` en F011) |
| Fuga de datos de partida oficial vía nombre/ganador | Los campos expuestos en notificaciones globales son `gameId`, `nombre` e `ganadorNombre` — ninguno sensible; el GameStateView completo sigue siendo exclusivo del canal de partida (`subscribe`) |
| Notificaciones de entrenamiento exponen progreso del agente | Solo el equipo propietario recibe estas notificaciones; el scope RBAC se aplica en handshake |

---

## 10. Consideraciones operativas

- **Sin estado persistente**: las notificaciones son in-memory. Un reinicio del servidor no reenviará notificaciones perdidas durante la desconexión. Esto es aceptable para el contexto del evento (single-server, sin SLA de entrega garantizada).
- **Reconexión**: al reconectar, el cliente reenvía `subscribe:notifications`. **No hay backfill** de notificaciones perdidas — la UI muestra solo las notificaciones recibidas desde que se (re)establece la conexión. Las notificaciones anteriores a una desconexión se consideran perdidas sin necesidad de recuperación (ver §14 OPENQ-F018-01).
- **Volumen esperado**: en el evento habrá ~150 usuarios simultáneos como máximo. Con 1 listener global y ≤20 listeners de equipo, el overhead sobre el EventEmitter es despreciable.
- **No afecta el ciclo F011**: los canales de partida (`subscribe { gameId }`) y notificaciones (`subscribe:notifications`) son independientes en el mismo servidor. Un error en el NotificationEmitter no afecta a la Arena.

---

## 11. Estados de conexión y comportamiento por rol

| Rol | Scope automático al conectar | Recibe |
|---|---|---|
| `admin` | `global` | `notification:game_*`, `notification:ranking_updated` |
| `equipo` | `{ team: equipoId }` | Todo lo anterior + `notification:training_*` de su equipo |
| `espectador` | `global` | `notification:game_*`, `notification:ranking_updated` |

El `NotificationContext` determina el scope a partir de `useAppSession()` y lo envía automáticamente en `subscribe:notifications` al conectar.

---

## 12. Plan de implementación

Las tareas se ordenan de menor a mayor dependencia:

| # | Tarea | Fichero(s) | Dependencias |
|---|---|---|---|
| 1 | Definir tipos y schemas Zod en `protocol.ts` | `src/lib/ws/protocol.ts` | — |
| 2 | Crear `NotificationEmitter.ts` singleton | `src/lib/ws/NotificationEmitter.ts` | — |
| 3 | Extender `server.ts` con handler `subscribe:notifications` | `src/lib/ws/server.ts` | 1, 2 |
| 4 | Integrar emisión en `training-loop.ts` | `src/lib/game/training-loop.ts` | 2 |
| 5 | Integrar emisión en Route Handlers de partidas oficiales | `src/app/api/games/route.ts` y `actions/` | 2 |
| 6 | Crear `NotificationContext.tsx` + hook `useNotifications` | `src/contexts/NotificationContext.tsx` | 1 |
| 7 | Crear `NotificationToast.tsx` y añadir a `AppShell` | `src/components/layout/` | 6 |
| 8 | Tests unitarios del emitter y del contexto | `src/tests/` | 2, 6 |

---

## 13. Criterios de aceptación

- [ ] Un equipo que lanza una partida de entrenamiento recibe un toast de inicio en ≤ 500 ms.
- [ ] Al finalizar el entrenamiento, el equipo recibe el resultado (ganador, turnos, puntos simulados).
- [ ] Si el entrenamiento aborta con error, el equipo recibe una notificación de error con el mensaje.
- [ ] Todos los usuarios conectados (cualquier rol) reciben notificación de inicio/fin de partida oficial.
- [ ] Un usuario con rol `equipo` no puede suscribirse a notificaciones de entrenamiento de otro equipo (el servidor devuelve `error: FORBIDDEN`).
- [ ] Al reconectar, el cliente restablece la suscripción de notificaciones automáticamente.
- [ ] El icono de campana en el header muestra el número de notificaciones no leídas.
- [ ] `npm run type-check` pasa sin errores tras implementar los nuevos tipos.

---

## 14. Preguntas abiertas

| ID | Pregunta | Estado | Decisión |
|---|---|---|---|
| OPENQ-F018-01 | ¿Debe existir backfill de notificaciones perdidas tras reconexión? | **Cerrada** | **No.** Sin persistencia en BD. Las notificaciones perdidas durante una desconexión no se recuperan. Aceptable para el contexto del evento. |
| OPENQ-F018-02 | ¿Las notificaciones de `training_turn` deben incluir el reasoning del LLM o solo la acción? | **Abierta** | Pendiente. Por defecto solo la acción (`accion` enum). El reasoning queda en el panel de detalle de entrenamiento (F015), no en el toast. |
| OPENQ-F018-03 | ¿El admin debe recibir las notificaciones de entrenamiento de todos los equipos? | **Cerrada** | **No.** El admin recibe únicamente notificaciones globales (partidas oficiales). Las notificaciones de entrenamiento son exclusivas del equipo propietario. |
| OPENQ-F018-04 | ¿La campana de notificaciones debe ser visible para espectadores no autenticados? | **Cerrada** | **No.** Solo usuarios autenticados. No se implementa scope anónimo en el MVP. |

---

## 15. Referencias

| Recurso | Descripción |
|---|---|
| RFC F011 | Diseño base del WebSocket server, custom server, protocolo y GameEventEmitter |
| RFC F015 | Training Arena: modelo de datos, flujo del training loop, Route Handler POST /api/training/games |
| RFC F007 | Coordinador del motor de juego: ciclo de vida de partidas oficiales |
| `src/lib/ws/server.ts` | Implementación actual del servidor WebSocket (subscription map, heartbeat, RBAC) |
| `src/lib/ws/GameEventEmitter.ts` | Patrón singleton `globalThis` para EventEmitter cross-bundle |
| `src/lib/game/training-loop.ts` | Loop de entrenamiento; punto de integración de la emisión de eventos |
