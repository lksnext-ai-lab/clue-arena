# RFC F008 — Gestión de partidas por el administrador

| Campo | Valor |
|---|---|
| **ID** | F008 |
| **Título** | Gestión del ciclo de vida de partidas: creación, arranque, ejecución (auto/manual) y cierre |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [30-ui-spec §UI-006, UI-007, UI-008](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [60-backend §API-009..013](../../clue-arena-spec/docs/spec/60-backend.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [10-requisitos-funcionales §FR-004, FR-013](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) |
| **Deps.** | RFC F001 · RFC F005 · RFC F007 |

---

## 1. Resumen

Este RFC describe el diseño completo de la **gestión de partidas por parte del administrador** en Clue Arena. Cubre:

1. **Creación** de partidas con selección de equipos participantes (UI-007 / API-010).
2. **Arranque** de una partida pendiente (API-012) y elección del **modo de ejecución** (auto o manual).
3. **Ciclo de ejecución** en modo auto (`run`) con soporte para pausa (`pause`) y reanudación (`resume`), y en modo manual con avance turno a turno (`advance-turn`).
4. **Cierre forzado** de una partida en curso (API-013) y cierre automático por victoria o eliminación total.
5. **Monitorización** en tiempo real desde el detalle de partida (UI-008): historial completo de turnos, cartas mostradas, errores, sobre revelado.

El resultado es una plataforma que permite al administrador orquestar competiciones completas con mínima intervención, o depurar paso a paso durante pruebas.

---

## 2. Motivación y contexto

### 2.1 Rol del administrador en el juego

A diferencia de los equipos (que interactúan exclusivamente a través de sus agentes MCP) y de los espectadores (vista de solo lectura), el administrador es el **operador del evento**:

- Define qué equipos se enfrentan en cada partida.
- Controla cuándo arranca y cuándo puede terminar anticipadamente.
- Tiene visibilidad completa (cartas de todos los equipos, carta_mostrada en sugerencias, contenido del sobre desde el inicio).
- Puede intervenir en partidas problemáticas sin romper el estado del juego.

### 2.2 Problema de diseño: ejecución automática vs. manual

El motor de juego (F007) es **puro y síncrono** — no sabe cuándo invocarlo. Hacen falta dos modos de operación:

| Modo | Cuándo se usa | Quién avanza los turnos |
|---|---|---|
| `auto` | Evento en producción | Loop `startAutoRun` (fire-and-forget) |
| `manual` | Desarrollo, demos, depuración | Admin pulsa "Avanzar turno" en UI-008 |
| `pausado` | Intervención durante `auto` | Admin pausa; el loop se detiene entre turnos |

El campo `partidas.modoEjecucion` (`manual` | `auto` | `pausado`) y `autoRunActivoDesde` permiten al sistema saber cuál es el estado del loop en cualquier momento.

---

## 3. Modelo de datos relevante

### 3.1 Tabla `partidas` — campos de gestión

```typescript
// src/lib/db/schema.ts (fragmento)
export const partidas = sqliteTable('partidas', {
  id:               text('id').primaryKey(),                          // UUID v4
  nombre:           text('nombre').notNull(),                         // Ej: "Ronda 1"
  estado: text('estado', {
    enum: ['pendiente', 'en_curso', 'finalizada'],
  }).notNull().default('pendiente'),
  turnoActual:      integer('turno_actual').notNull().default(0),
  modoEjecucion: text('modo_ejecucion', {
    enum: ['manual', 'auto', 'pausado'],
  }).notNull().default('manual'),
  autoRunActivoDesde: integer('auto_run_activo_desde', { mode: 'timestamp' }),
  iniciadaAt:       integer('iniciada_at', { mode: 'timestamp' }),
  finalizadaAt:     integer('finalizada_at', { mode: 'timestamp' }),
  createdAt:        integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### 3.2 Máquina de estados de `partidas.estado`

```
             POST /api/games
                  │
                  ▼
            ┌──────────┐
            │ pendiente │ ◄─── (recién creada)
            └──────────┘
                  │
                  │ POST /api/games/:id/start
                  ▼
            ┌──────────┐
            │ en_curso  │ ──────────────────────────────────────────┐
            └──────────┘                                           │
          ┌───┴──────────────────┐                                 │
          │ modoEjecucion=auto   │ modoEjecucion=manual             │
          │ startAutoRun() →     │ Admin pulsa "Avanzar turno"      │
          │ loop de turnos       │ POST .../advance-turn            │
          └──────────────────────┘                                 │
                                                                   │
                  │ Victoria / Eliminación total / POST .../stop    │
                  ▼                                                 │
            ┌──────────┐                                           │
            │finalizada │ ◄─────────────────────────────────────────┘
            └──────────┘
```

### 3.3 Máquina de estados de `modoEjecucion` (solo cuando `estado = en_curso`)

```
    start(modo='manual')     start(modo='auto')
           │                        │
           ▼                        ▼
        ┌────────┐           ┌──────────┐
        │ manual │           │   auto   │ ◄──── POST .../resume
        └────────┘           └──────────┘
                                   │
                             POST .../pause
                                   │
                                   ▼
                             ┌──────────┐
                             │ pausado  │
                             └──────────┘
```

> **Nota**: `modoEjecucion` no tiene significado cuando `estado = pendiente` o `finalizada`. Se conserva el último valor para referencia pero no se actúa sobre él.

---

## 4. API REST — Catálogo extendido

Los endpoints base (API-009..013) están definidos en la spec. Este RFC documenta también los endpoints adicionales implementados para el ciclo avanzado.

| ID | Método | Ruta | Descripción | Roles |
|---|---|---|---|---|
| API-009 | GET | `/api/games` | Lista partidas (con paginación por `?estado=`) | Admin |
| API-010 | POST | `/api/games` | Crea partida con equipos seleccionados | Admin |
| API-011 | GET | `/api/games/:id` | Estado completo de una partida (Admin ve todo; público ve versión censurada) | Público / Admin |
| API-012 | POST | `/api/games/:id/start` | Inicia partida `pendiente` | Admin |
| API-013 | POST | `/api/games/:id/stop` | Finaliza partida manualmente | Admin |
| API-015 | POST | `/api/games/:id/run` | Activa el loop auto-run (fire-and-forget) | Admin |
| API-016 | POST | `/api/games/:id/pause` | Pausa el loop auto-run | Admin |
| API-017 | POST | `/api/games/:id/resume` | Reanuda el loop tras pausa | Admin |
| API-018 | POST | `/api/games/:id/advance-turn` | Avanza un turno en modo manual | Admin |
| API-019 | GET | `/api/games/activity` | Últimas N acciones de juego (todas las partidas) | Admin |

---

## 5. Detalle de endpoints

---

### API-010 — POST /api/games

- **Roles**: Admin.
- **Request body**:
  ```json
  { "nombre": "Ronda 1", "equipoIds": ["uuid-a", "uuid-b", "uuid-c"] }
  ```
- **Proceso**:
  1. Valida con `CreateGameSchema` (Zod): `nombre` 1–100 chars, `equipoIds` array de 2..6 UUIDs.
  2. Verifica que todos los equipos existen en BD.
  3. Llama a `initGame(equipoIds)` → `GameState` puro: sortea el sobre, asigna cartas.
  4. Persiste `partidas`, `sobres`, `partidaEquipos` (con `cartas` por equipo) en una transaction.
- **Respuesta 201**:
  ```json
  { "id": "uuid", "nombre": "Ronda 1", "estado": "pendiente", "equipos": [...], "creadaAt": "..." }
  ```
- **Errores**:
  - 422 con `errors` por campo si fallan validaciones Zod.
  - 400 `EQUIPOS_INVALIDOS` si algún `equipoId` no existe.
  - 409 (advertencia no bloqueante MVP) si algún equipo ya está en una partida `en_curso`.

---

### API-012 — POST /api/games/:id/start

- **Roles**: Admin.
- **Precondiciones**: `partidas.estado = 'pendiente'`.
- **Request body (opcional)**:
  ```json
  { "modo": "auto" | "manual", "turnoDelayMs": 3000 }
  ```
  - `modo` por defecto: `"manual"`.
  - `turnoDelayMs` (solo si `modo = auto`): delay entre turnos en ms, rango 0..60000, por defecto 3000.
- **Proceso**:
  1. Actualiza `partidas.estado = 'en_curso'`, `iniciadaAt = now()`, `modoEjecucion = modo`.
  2. Crea el primer registro de `turnos` para el equipo con `orden = 0`.
  3. Si `modo = auto`: llama `startAutoRun(gameId, turnoDelayMs)` **sin await** (fire-and-forget) y registra `autoRunActivoDesde = now()`.
- **Respuesta 200**:
  ```json
  { "id": "...", "estado": "en_curso", "modoEjecucion": "auto", "iniciadaAt": "..." }
  ```
- **Errores**:
  - 404 si partida no existe.
  - 409 si `estado ≠ 'pendiente'`.

---

### API-015 — POST /api/games/:id/run

- **Roles**: Admin.
- **Precondiciones**: `estado = 'en_curso'`. `autoRunActivoDesde IS NULL` (ningún loop activo).
- **Request body (opcional)**: `{ "turnoDelayMs": 3000 }`
- **Proceso**:
  1. Verifica que no hay loop activo (`autoRunActivoDesde IS NOT NULL` → 409).
  2. Actualiza `modoEjecucion = 'auto'`, `autoRunActivoDesde = now()`.
  3. Lanza `startAutoRun(gameId, turnoDelayMs)` **sin await**.
- **Respuesta 202 Accepted**:
  ```json
  { "modoEjecucion": "auto", "autoRunActivoDesde": "..." }
  ```
- **Errores**:
  - 409 `LOOP_YA_ACTIVO` si `autoRunActivoDesde IS NOT NULL`.
  - 409 si `estado ≠ 'en_curso'`.

---

### API-016 — POST /api/games/:id/pause

- **Roles**: Admin.
- **Precondiciones**: `estado = 'en_curso'`, `modoEjecucion = 'auto'`.
- **Proceso**: Actualiza `modoEjecucion = 'pausado'`. El loop lee este valor al inicio del siguiente turno y se detiene. **El turno en curso no se interrumpe**.
- **Respuesta 200**:
  ```json
  { "modoEjecucion": "pausado" }
  ```
- **Efecto**: `autoRunActivoDesde` se conserva hasta que el loop termina realmente (limpiado por el propio loop al salir).

---

### API-017 — POST /api/games/:id/resume

- **Roles**: Admin.
- **Precondiciones**: `estado = 'en_curso'`, `modoEjecucion = 'pausado'`, `autoRunActivoDesde IS NULL`.
- **Request body (opcional)**: `{ "turnoDelayMs": 3000 }`
- **Proceso**: Actualiza `modoEjecucion = 'auto'`, `autoRunActivoDesde = now()`. Lanza `startAutoRun` **sin await**.
- **Respuesta 202 Accepted**:
  ```json
  { "modoEjecucion": "auto", "autoRunActivoDesde": "..." }
  ```

---

### API-018 — POST /api/games/:id/advance-turn

- **Roles**: Admin.
- **Precondiciones**: `estado = 'en_curso'`, `modoEjecucion = 'manual'`.
- **Proceso**: Llama a `advanceTurn(gameId)` del coordinador (F007) **síncronamente** y espera el resultado. Retorna el resultado del turno.
- **Respuesta 200**:
  ```json
  {
    "turno": {
      "numero": 5,
      "equipoNombre": "Equipo A",
      "estado": "completado",
      "sugerencia": { "sospechoso": "Scarlet", "arma": "Cuerda", "habitacion": "Cocina", "refutadaPor": "Equipo B", "cartaMostrada": "Cuerda" },
      "acusacion": null
    },
    "partidaFinalizada": false
  }
  ```
  Si la partida finalizó durante el turno: `"partidaFinalizada": true` más el sobre.
- **Errores**:
  - 409 si `modoEjecucion ≠ 'manual'` (usar `/run` para modo auto).
  - 500 con `CoordinatorError` tipado si falla la invocación al agente.

---

### API-013 — POST /api/games/:id/stop

- **Roles**: Admin.
- **Proceso**:
  1. Actualiza `modoEjecucion = 'manual'` (para detener el loop auto si estaba activo).
  2. Actualiza `estado = 'finalizada'`, `finalizadaAt = now()`.
  3. Cierra el turno activo como `estado = 'interrumpido'` si existe.
  4. Calcula y persiste puntuaciones finales (solo equipos activos acumulan puntos por rondas completadas).
- **Respuesta 200**:
  ```json
  { "id": "...", "estado": "finalizada", "sobre": { "sospechoso": "...", "arma": "...", "habitacion": "..." } }
  ```
- **Idempotencia**: si `estado` ya es `finalizada` → 200 sin efectos secundarios.

---

### API-019 — GET /api/games/activity

- **Roles**: Admin (puede relajarse a `Autenticado` si se decide exponer a espectadores).
- **Query params**: `?limit=10` (1–50, por defecto 10).
- **Propósito**: feed de actividad reciente de **todas** las partidas para el panel admin (sección "Errores/actividad reciente" de UI-006).
- **Respuesta 200**:
  ```json
  {
    "events": [
      {
        "id": "...",
        "timestampMs": 1708956200000,
        "tipo": "sugerencia" | "acusacion" | "error_turno",
        "actorNombre": "Equipo A",
        "descripcion": "Sugiere Scarlet con Cuerda en Cocina"
      }
    ]
  }
  ```

---

## 6. Pantallas de administración

### 6.1 UI-006 — Panel Admin (`/admin`)

**Componentes relevantes a partidas**:

- **Sección "Partidas"**: lista de todas las partidas con pill de estado (`pendiente`, `en_curso`, `finalizada`) y enlace a UI-008.
- **Botón "Nueva partida"**: navega a UI-007.
- **Sección "Actividad reciente"**: últimas 10 acciones via `GET /api/games/activity?limit=10`.

**Estados de la sección de partidas**:

| Estado | Vista |
|---|---|
| Sin partidas | "No hay partidas. Crea la primera." |
| Listado normal | Tarjetas con nombre, turno actual, estado y botón "Gestionar" |
| Error al cargar | Banner de error con botón reintentar |

---

### 6.2 UI-007 — Crear partida (`/admin/partidas/nueva`)

**Flujo**:

1. Carga lista de equipos (`GET /api/teams`).
2. Admin escribe nombre de partida (campo de texto, requerido, 1–100 chars).
3. Selecciona 2–6 equipos con toggle visual (checkbox estilizado por equipo).
4. Si equipo sin `agent_id`: badge de advertencia "Sin agente".
5. Submit → `POST /api/games` → redirige a UI-008 con la partida recién creada.

**Componente**: `src/app/admin/partidas/nueva/page.tsx` — Client Component.

**Estados**:

| Estado | Vista |
|---|---|
| Cargando equipos | Skeletons en la grid de equipos |
| Sin equipos | "No hay equipos registrados. Ve al panel de equipos." |
| < 2 seleccionados | Botón deshabilitado + mensaje "Selecciona al menos 2 equipos" |
| Error de servidor | Banner con mensaje del error |

**Validaciones** (Zod, `CreateGameSchema`):

```typescript
// src/lib/schemas/game.ts
export const CreateGameSchema = z.object({
  nombre: z.string().min(1).max(100),
  equipoIds: z.array(z.string().uuid()).min(2).max(6),
});
```

---

### 6.3 UI-008 — Detalle de partida Admin (`/admin/partidas/[id]`)

**Propósito**: monitorizar y controlar una partida con polling cada 3 s.

**Arquitectura de componente**:

```
AdminPartidaPage (async Server Component)
  └─ GameProvider (gameId, pollingInterval=3000)  ← GameContext polling
       └─ AdminPartidaContent (Client Component)
            ├─ Header: nombre, turno, estado, badge modoEjecucion
            ├─ ControlBar: botones de control según estado
            ├─ EquiposGrid: tarjeta por equipo (activo/eliminado, puntos, cartas)
            ├─ TurnosLog: historial completo con sugerencias y acusaciones
            └─ SobreReveal: (solo si finalizada)
```

**ControlBar — botones disponibles por estado**:

| Estado partida | modoEjecucion | Botones |
|---|---|---|
| `pendiente` | — | **Iniciar (manual)**, **Iniciar (auto)** |
| `en_curso` | `manual` | **Avanzar turno**, **Activar auto-run**, **Finalizar** |
| `en_curso` | `auto` | **Pausar**, **Finalizar** |
| `en_curso` | `pausado` | **Reanudar**, **Avanzar turno**, **Finalizar** |
| `finalizada` | — | (solo lectura) |

**Visibilidad privilegiada del Admin** (frente a la vista de espectador):

| Dato | Espectador | Admin |
|---|---|---|
| `carta_mostrada` en sugerencias | Oculta (null) | Visible |
| Cartas de cada equipo | Ocultas | Visibles (nº y nombres) |
| Contenido del sobre | Oculto hasta `finalizada` | Visible desde el inicio |
| Errores de turno | No disponibles | Badge en historial de turnos |

**Polling**: `GameContext` con `pollingInterval=3000` sondea `GET /api/games/:id` cada 3 s mientras la partida está `en_curso`. Cuando la partida pasa a `finalizada`, el contexto para el polling automáticamente.

---

## 7. Loop de auto-run (`src/lib/game/auto-run.ts`)

El loop `startAutoRun` es una función **fire-and-forget** que corre en el proceso Node.js del servidor sin bloquear el Route Handler.

```
startAutoRun(gameId, delayMs)
  └─ while (true)
       ├─ Leer partida: estado, modoEjecucion
       ├─ Si estado = 'finalizada' → break
       ├─ Si modoEjecucion ≠ 'auto' → break
       ├─ advanceTurn(gameId)        ← coordinador F007
       ├─ Si turno finaliza partida → break
       └─ sleep(delayMs)
  └─ UPDATE autoRunActivoDesde = NULL  (cleanup)
```

**Invariantes de seguridad**:

- **Un solo loop por partida**: el Route Handler `/run` y `/resume` verifican que `autoRunActivoDesde IS NULL` antes de lanzar el loop. Si no, responden 409.
- **Pausa no interrumpe el turno en curso**: el loop comprueba `modoEjecucion` al inicio de cada iteración, **antes** de llamar a `advanceTurn`. Un turno ya iniciado siempre completa.
- **Limpieza garantizada**: el `try/finally` en `startAutoRun` asegura que `autoRunActivoDesde` se borra aunque el loop termine por error.

---

## 8. Auto-run en producción vs. desarrollo

| Escenario | Configuración recomendada |
|---|---|
| Evento en producción (competición real) | `start` con `modo=auto`, `turnoDelayMs=3000` |
| Ensayo / demo con audiencia | `start` con `modo=auto`, `turnoDelayMs=5000`–`10000` |
| Depuración de un agente | `start` con `modo=manual`, usar "Avanzar turno" paso a paso |
| Diagnóstico en producción | `pause` → inspeccionar turno → `resume` o `advance-turn` |

---

## 9. Cierre automático de partida

El motor (`engine.ts`) puede finalizar una partida sin intervención del admin en dos casos:

1. **Victoria**: un agente hace `make_accusation` correcta → `applyAction` devuelve `gameOver: true, winner: equipoId`.
2. **Eliminación total**: todos los equipos han sido eliminados por acusaciones incorrectas → `isGameOver(state) = true`.

En ambos casos, `advanceTurn` (coordinador F007) detecta `gameOver = true` y:

1. Actualiza `partidas.estado = 'finalizada'`, `finalizadaAt = now()`.
2. Revela el sobre (si victoria: el sobre ya es correcto; si todos eliminados: se revela igualmente).
3. Calcula y persiste puntuaciones finales en `rankings`.
4. El loop `startAutoRun` detecta `estado = 'finalizada'` en la siguiente iteración y termina.

---

## 10. Invariantes de seguridad y RBAC

- Todos los endpoints de gestión (`/api/games`, `/api/games/:id/start|stop|run|pause|resume|advance-turn`) requieren `sesión válida + rol = admin`.
- `GET /api/games/:id` es público pero **censura** en función del rol que consulta:
  - `carta_mostrada`: solo visible para admin o para el equipo propietario de la sugerencia.
  - `sobres.contenido`: solo visible cuando `estado = 'finalizada'` (o si rol = admin, siempre).
- El endpoint `/api/mcp` (F007) **no** debe importar ni depender de la gestión de partidas de este RFC; su autenticación es por token Bearer independiente.
- La API key de MattinAI (`MATTIN_API_KEY`) nunca aparece en respuestas de ninguno de estos endpoints.

---

## 11. Manejo de errores en el ciclo de turnos

| Error | Origen | Comportamiento |
|---|---|---|
| Timeout de agente (>30 s) | Coordinador F007 | Turno marcado como `error`; se avanza al siguiente equipo |
| Error 5xx de MattinAI | Cliente MattinAI | Un reintento; si falla → turno `error`, se avanza |
| `CoordinatorError` | `advanceTurn` | En modo auto: loop continúa con siguiente equipo. En modo manual: endpoint devuelve 500 con detalles |
| Loop auto interrumpido (proceso reiniciado) | Node.js crash | `autoRunActivoDesde` queda sucio. Solución: el admin usa "Reanudar auto" desde UI-008 (limpia y relanza) |

> **RISK**: si el proceso Node.js se reinicia con `autoRunActivoDesde IS NOT NULL`, la partida queda en estado inconsistente (en_curso + modoEjecucion=auto pero sin loop activo). El admin debe detectarlo via UI-008 (poll muestra que el turno no avanza) y pulsar "Reanudar". Ver TODO-031.

---

## 12. Tests

### 12.1 Tests unitarios (`src/tests/`)

| Fichero | Qué se prueba |
|---|---|
| `game-engine.test.ts` | Lógica pura del motor (sin admin) — ya existe |
| `auto-run.test.ts` | `startAutoRun`: terminación correcta por estado, por modoEjecucion, cleanup de `autoRunActivoDesde` |
| `mcp-tools.test.ts` | Herramientas MCP (F007) |

### 12.2 Tests de Route Handlers

| Endpoint | Casos cubiertos |
|---|---|
| `POST /api/games` | Creación correcta, equipos inválidos, validación Zod |
| `POST /api/games/:id/start` | Estado `pendiente` OK, estado `en_curso` → 409, modo auto vs manual |
| `POST /api/games/:id/stop` | Idempotencia (ya finalizada → 200), cálculo de puntuaciones |
| `POST /api/games/:id/run` | Loop ya activo → 409, activación correcta |
| `POST /api/games/:id/pause` | Cambio de modo, turno en curso no interrumpido |
| `POST /api/games/:id/advance-turn` | Turno avanzado en modo manual, error si modo ≠ manual |

### 12.3 Tests E2E (Playwright)

| Fichero | Flujo |
|---|---|
| `e2e/admin-game-lifecycle.spec.ts` | Login admin → crear partida → iniciar (manual) → avanzar 3 turnos → finalizar |
| `e2e/admin-autorun.spec.ts` | Iniciar en modo auto → pausar → reanudar → esperar finalización |

---

## 13. Componentes UI implicados

| Componente | Ruta | Descripción |
|---|---|---|
| `NuevaPartidaPage` | `src/app/admin/partidas/nueva/page.tsx` | Formulario de creación (Client Component) |
| `AdminPartidaPage` | `src/app/admin/partidas/[id]/page.tsx` | Shell async + `GameProvider` |
| `AdminPartidaContent` | (en el mismo fichero) | Panel de control con polling (Client Component) |
| `AdminPage` | `src/app/admin/page.tsx` | Panel general; sección de partidas + botón crear |
| `GameContext` | `src/contexts/GameContext.tsx` | Polling compartido con espectador; admin usa mismo contexto con privilegios adicionales |
| `CreateGameSchema` | `src/lib/schemas/game.ts` | Validación compartida cliente/servidor |

---

## 14. Flujo completo — Partida de principio a fin

```
Admin en UI-006
    │
    ├─► "Nueva partida" → UI-007
    │       Selecciona equipos: A, B, C
    │       POST /api/games → { id, estado: "pendiente" }
    │
    ├─► Redirige a UI-008 (partida pendiente)
    │       Equipos visibles, sobre visible (admin)
    │       Botones: [Iniciar manual] [Iniciar auto]
    │
    ├─► "Iniciar auto" → POST /api/games/:id/start { modo: "auto" }
    │       estado → "en_curso", modoEjecucion → "auto"
    │       startAutoRun() lanzado
    │
    ├─► UI-008 polling cada 3s
    │       Turno avanza automáticamente: 1 → 2 → 3 → ...
    │       ControlBar: [Pausar] [Finalizar]
    │
    ├─► (Opcional) "Pausar" → POST /api/games/:id/pause
    │       modoEjecucion → "pausado"
    │       Turno en curso completa; loop se detiene
    │       ControlBar: [Reanudar] [Avanzar turno] [Finalizar]
    │
    ├─► "Reanudar" → POST /api/games/:id/resume
    │       modoEjecucion → "auto", nuevo loop lanzado
    │
    └─► Fin automático (victoria/eliminación total)
            estado → "finalizada"
            UI-008: SobreReveal, ganador, puntuaciones finales
            Polling se detiene
```

---

## 15. Pendientes y preguntas abiertas

| ID | Descripción | Impacto |
|---|---|---|
| TODO-031 | Detectar y recuperar `autoRunActivoDesde` sucio tras reinicio de proceso | Fiabilidad en producción |
| TODO-032 | Agregar endpoint `DELETE /api/games/:id` para eliminar partidas en estado `pendiente` | Limpieza de partidas de prueba |
| OPENQ-020 | ¿Debe el admin poder reasignar equipos en una partida `pendiente`? | Afecta a UI-007 y API-010 |
| OPENQ-021 | ¿Se archivan automáticamente las partidas finalizadas tras X horas? | Afecta a limpieza de BD y ranking histórico |

---

## Fuentes

| URL | Fecha | Qué se extrajo |
|---|---|---|
| `src/app/api/games/` | 2026-02-26 | Implementación actual de endpoints de gestión de partidas |
| `src/lib/game/auto-run.ts` | 2026-02-26 | Diseño del loop fire-and-forget y sus invariantes |
| `src/app/admin/partidas/[id]/page.tsx` | 2026-02-26 | UI-008 actual: controles, polling, historial |
| [spec/60-backend.md](../../clue-arena-spec/docs/spec/60-backend.md) | 2026-02-26 | Catálogo de endpoints API-009..013 y reglas de seguridad |
| [spec/30-ui-spec.md](../../clue-arena-spec/docs/spec/30-ui-spec.md) | 2026-02-26 | Especificación de UI-006, UI-007, UI-008 |
