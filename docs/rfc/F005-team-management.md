# RFC F005 — Creación y gestión de equipos

| Campo | Valor |
|---|---|
| **ID** | F005 |
| **Título** | Creación y gestión de equipos (registro, panel de equipo y administración) |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [10-requisitos-funcionales §FR-002, FR-003](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [20-conceptualizacion §FLW-001](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [30-ui-spec §UI-002, UI-003, UI-006](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [60-backend §API-005..008](../../clue-arena-spec/docs/spec/60-backend.md) · [50-modelo-datos](../../clue-arena-spec/docs/spec/50-modelo-datos.md) |
| **Deps.** | RFC F001 · RFC F002 · RFC F004 |

---

## 1. Resumen

Este RFC define el diseño e implementación de la funcionalidad de **creación y gestión de equipos** en Clue Arena, que cubre dos flujos distintos pero relacionados:

1. **Registro de equipo** (FR-002, UI-002): un usuario con rol `equipo` registra por primera vez su equipo proporcionando nombre y `agent_id`. Es el flujo principal del participante antes de competir.
2. **Panel de equipo** (FR-002, UI-003): pantalla de dashboard del participante que muestra el estado de su equipo, partidas asignadas y posición en el ranking. Se mantiene actualizado via polling.
3. **Gestión de equipos Admin** (FR-003, UI-006): el administrador puede listar, editar y eliminar equipos desde el panel de administración.

El resultado final es:

- Formulario de registro en `/equipo/registro` con validación Zod compartida cliente/servidor.
- Panel de equipo en `/equipo` con polling (30 s) mostrando estado del equipo y partidas.
- Sección de gestión en `/admin` con tabla de equipos y acciones inline de edición / eliminación.
- API REST completa: `GET /api/teams`, `POST /api/teams`, `GET /api/teams/:id`, `PUT /api/teams/:id`, `DELETE /api/teams/:id`.
- Schema Drizzle `equipos` como fuente de verdad; `TeamRegistrationSchema` y `UpdateTeamSchema` compartidos.

---

## 2. Motivación

La gestión de equipos es la funcionalidad de entrada para los participantes y un requisito previo para poder lanzar partidas. Sin equipos registrados con un `agent_id` válido, el Admin no puede crear partidas (FR-004 depende de FR-003 y FR-002).

Los retos principales de este módulo son:

| Reto | Decisión |
|---|---|
| Validación de unicidad de nombre en tiempo real | Validación servidor en `POST`/`PUT`; error 400 `NOMBRE_DUPLICADO` con mensaje inline. Sin comprobación asíncrona en cliente (YAGNI para MVP de evento). |
| Un usuario solo puede tener un equipo | Check en `POST /api/teams` contra `equipos.usuarioId = user.id`. Error 409 `YA_TIENE_EQUIPO`. |
| El Admin puede editar/eliminar; el Equipo solo puede ver | RBAC explícito en cada Route Handler además del middleware. |
| Eliminación protegida si equipo está en partida activa | Advertencia en respuesta 409 `EQUIPO_EN_PARTIDA`; el admin confirma con segundo paso. |
| Sincronización del `SessionContext` tras registro | Tras `POST /api/teams` exitoso, contexto se actualiza llamando `/api/auth/session` y re-renderizando. |

---

## 3. Modelo de datos

### 3.1 Tabla `equipos` (Drizzle schema)

```typescript
// src/lib/db/schema.ts
export const equipos = sqliteTable('equipos', {
  id: text('id').primaryKey(),                          // UUID v4
  nombre: text('nombre').notNull().unique(),             // 3–50 chars, único
  agentId: text('agent_id').notNull(),                  // ID del agente en MattinAI
  usuarioId: text('usuario_id')                         // FK → usuarios.id
    .references(() => usuarios.id)
    .notNull(),
  estado: text('estado', {
    enum: ['registrado', 'activo', 'finalizado'],
  }).notNull().default('registrado'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

### 3.2 Estados del equipo

| Estado | Cuando | Efecto |
|---|---|---|
| `registrado` | Tras `POST /api/teams` | Disponible para selección al crear partida |
| `activo` | Al asignarse a una partida `en_curso` | No eliminable sin advertencia |
| `finalizado` | Al terminar la última partida del equipo | Solo lectura en panel |

> **Transición de estado**: las transiciones `registrado → activo` y `activo → finalizado` las realiza el motor de juego (`engine.ts`) al arrancar/finalizar partidas; no son editables directamente desde la gestión de equipos.

### 3.3 Esquemas Zod (fuente de verdad compartida cliente/servidor)

```typescript
// src/lib/schemas/team.ts

export const TeamRegistrationSchema = z.object({
  nombre: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(50, 'El nombre no puede superar 50 caracteres')
    .regex(
      /^[\w\s\-áéíóúÁÉÍÓÚñÑüÜ]+$/,
      'Solo se permiten letras, números, espacios y guiones',
    ),
  agentId: z.string().min(1, 'El agent_id es requerido'),
});

export const UpdateTeamSchema = z.object({
  nombre: z.string().min(3).max(50).optional(),
  agentId: z.string().min(1).optional(),
  estado: z.enum(['registrado', 'activo', 'finalizado']).optional(),
});
```

---

## 4. API REST

### 4.1 Catálogo

| ID | Método | Ruta | Roles | FR |
|---|---|---|---|---|
| API-005 | GET | `/api/teams` | Admin (todos), Equipo (solo el propio) | FR-003, FR-002 |
| API-006 | POST | `/api/teams` | Equipo | FR-002 |
| API-005b | GET | `/api/teams/:id` | Admin, Equipo (solo el propio) | FR-002, FR-003 |
| API-007 | PUT | `/api/teams/:id` | Admin | FR-003 |
| API-008 | DELETE | `/api/teams/:id` | Admin | FR-003 |

### 4.2 GET /api/teams

- **Descripción**: Lista equipos. Admin recibe todos; rol Equipo recibe solo el suyo (`usuarioId = session.user.id`).
- **Auth**: sesión requerida.
- **Respuesta 200**: `{ teams: TeamResponse[] }`
- **Respuesta 401**: sin sesión.

```typescript
// Comportamiento diferenciado por rol
if (session.user.rol === 'admin') {
  teams = await db.select().from(equipos).all();
} else {
  const user = await db.select().from(usuarios).where(eq(usuarios.email, session.user.email)).get();
  teams = await db.select().from(equipos).where(eq(equipos.usuarioId, user.id)).all();
}
```

> **GAP identificado**: la implementación actual (`route.ts`) devuelve todos los equipos sin comprobación de rol. Debe corregirse para cumplir la spec (ver §7 — Gaps y trabajo pendiente).

### 4.3 POST /api/teams

- **Roles**: Equipo.
- **Body**: `{ nombre: string, agentId: string }`
- **Validaciones**: `TeamRegistrationSchema`; unicidad de nombre en BD; máximo 1 equipo por usuario.
- **Proceso**:
  1. Verificar sesión + rol `equipo`.
  2. Buscar usuario en BD por `email`.
  3. Comprobar que no tiene equipo (`WHERE usuario_id = user.id`).
  4. Comprobar unicidad del nombre.
  5. Insertar equipo con `id = uuidv4()`, `estado = 'registrado'`, `createdAt = new Date()`.
- **Respuesta 201**: `{ equipo: TeamResponse }`
- **Errores**:
  - 400 `NOMBRE_DUPLICADO` — nombre ya en uso.
  - 409 `YA_TIENE_EQUIPO` — usuario ya tiene equipo.
  - 403 `REGISTRO_CERRADO` — (futuro) período cerrado.
  - 401 — sin sesión.
  - 422 — error de validación Zod con detalle por campo.

### 4.4 GET /api/teams/:id

- **Roles**: Admin (cualquier equipo); Equipo (solo si `equipo.usuarioId === usuario.id`).
- **Respuesta 200**: `TeamResponse`
- **Errores**: 404 no encontrado; 403 acceso denegado.

### 4.5 PUT /api/teams/:id

- **Roles**: Admin exclusivamente.
- **Body**: `UpdateTeamSchema` (partial: `nombre?`, `agentId?`)
- **Validaciones**: si se incluye `nombre`, comprobar unicidad excluyendo el equipo actual.
- **Proceso**: verificar sesión con `rol === 'admin'`; validar body; actualizar en BD; retornar equipo actualizado.
- **Respuesta 200**: `TeamResponse`
- **Errores**: 400 `NOMBRE_DUPLICADO`; 403; 404; 422.

> **GAP**: la implementación actual no comprueba que el rol sea Admin antes de permitir el `PUT`. Debe añadirse la verificación.

### 4.6 DELETE /api/teams/:id

- **Roles**: Admin.
- **Proceso**:
  1. Verificar sesión + `rol === 'admin'`.
  2. Comprobar si el equipo participa en alguna partida con `estado = 'en_curso'`.
  3. Si hay partida activa → responder 409 `EQUIPO_EN_PARTIDA` con aviso en lugar de eliminar.
  4. Si no → eliminar equipo.
- **Respuesta 204**: sin cuerpo.
- **Errores**: 403; 404; 409 `EQUIPO_EN_PARTIDA`.

> **GAP**: la implementación actual elimina directamente sin comprobar partidas activas. Debe añadirse la comprobación.

---

## 5. Componentes de UI

### 5.1 UI-002 — Registro de equipo (`/equipo/registro`)

#### Flujo de navegación

```
/equipo  →  (sin equipo)  →  /equipo/registro
/equipo/registro  →  POST /api/teams  →  éxito  →  /equipo
                                       →  error   →  mensaje inline
```

#### Estructura del componente

```
TeamRegistrationPage  ["use client"]
├── <form> (React Hook Form + TeamRegistrationSchema)
│   ├── Campo "Nombre del equipo"  (input text + error)
│   ├── Campo "agent_id de MattinAI"  (input text + error + ayuda contextual)
│   ├── <ServerErrorBanner>  (error de servidor inline, si aplica)
│   └── <Button type="submit">  (deshabilitado mientras isSubmitting)
└── <HelpText> — instrucciones para obtener el agent_id
```

#### Ayuda contextual para `agent_id`

La spec ([20-conceptualizacion §FLW-001](../../clue-arena-spec/docs/spec/20-conceptualizacion.md)) señala que el equipo debe crear previamente un agente en MattinAI y copiar su `agent_id`. El componente debe incluir un texto de ayuda breve bajo el campo que explique dónde encontrarlo:

```
Obtén tu agent_id desde la ficha de tu agente en MattinAI.
Ejemplo: "agt_01HX..."
```

> Ver `OPENQ-015` para los pasos exactos de creación de agente en MattinAI.

#### Estados

| Estado | Renderizado |
|---|---|
| Inicial | Formulario vacío, botón activo |
| Enviando | Botón deshabilitado + spinner |
| Error de validación | Mensaje inline bajo el campo |
| Error de servidor (`NOMBRE_DUPLICADO`) | Banner rojo con "Ya existe un equipo con ese nombre." |
| Error de servidor (`YA_TIENE_EQUIPO`) | No debería alcanzarse en flujo normal (redirect en `/equipo`); si ocurre → banner con mensaje |
| Sin permisos | Redirect a `/` (gestionado por middleware) |

#### Integración con `SessionContext`

Tras registro exitoso, el servidor devuelve `201` con el equipo creado. El cliente debe refrescar la sesión para que `equipo` esté disponible en el contexto:

```typescript
// Después del POST exitoso
await apiFetch('/auth/session');     // Invalidar caché
router.push('/equipo');              // El SessionContext recargará
```

> **Decisión**: se confía en que `SessionContext` relee `/api/auth/session` al montar `/equipo` (o que `router.push` provoca re-render del layout). Si no sincroniza correctamente, añadir `router.refresh()` tras `router.push`.

---

### 5.2 UI-003 — Panel de equipo (`/equipo`)

#### Estructura del componente

```
EquipoPage  ["use client"]
├── <LoadingState>   (isLoading del SessionContext)
├── <NoTeamState>    (sin equipo → botón "Registrar equipo" → /equipo/registro)
└── <main>
    ├── <header>  Título + usuario + nombre del equipo
    ├── <ErrorBanner>  (fetchError, si aplica)
    ├── <TeamInfoSection>
    │   ├── Nombre del equipo
    │   ├── agent_id (monospace, truncado si largo)
    │   └── Estado (badge  registrado / activo / finalizado)
    ├── <GamesSection>
    │   ├── Lista de partidas con estado
    │   └── Enlace a UI-005 por partida
    └── <RankingSection>
        ├── Posición actual
        ├── Puntos totales
        └── Enlace a UI-004
```

#### Polling

- Intervalo: **30 segundos** via `useInterval`.
- Llamadas paralelas: `GET /api/games?estado=en_curso` y `GET /api/teams/:id`.
- Los datos previos se mantienen mientras se recarga (no flash de vacío).
- Si la llamada falla: mostrar `<ErrorBanner>` sin borrar los datos actuales.

#### Estados vacíos

| Sección | Estado vacío |
|---|---|
| Partidas | "Aún no tienes partidas asignadas." |
| Ranking | "El ranking estará disponible cuando comience el evento." |

---

### 5.3 UI-006 — Sección de equipos en Panel Admin (`/admin`)

> El Panel Admin es la pantalla global del administrador. Esta sección describe únicamente la gestión de equipos; el resto del panel (partidas, estado global) se especificará en el RFC correspondiente.

#### Estructura del sub-componente

```
AdminTeamsSection  ["use client" si pollea; Server Component si solo carga en mount]
├── <header>  "Equipos registrados"  +  contador
├── <TeamsTable>
│   ├── Columnas: Nombre · agent_id · Estado · Acciones
│   ├── <EditTeamRow>   (inline edit con formulario inplace o modal)
│   └── <DeleteTeamButton>  (con confirm dialog)
└── (sin botón "Crear equipo" — el registro es iniciativa del equipo, no del admin)
```

#### Flujo de edición inline

1. Admin pulsa el icono de edición en una fila.
2. Los campos `nombre` y `agentId` se vuelven editables (inputs inline o drawer lateral).
3. Al confirmar: `PUT /api/teams/:id` → actualizar fila en estado local.
4. Al cancelar: restaurar valores anteriores.
5. Error `NOMBRE_DUPLICADO`: mensaje inline en el campo nombre.

#### Flujo de eliminación

1. Admin pulsa el icono de eliminación.
2. Aparece un `<AlertDialog>` de confirmación: "¿Eliminar equipo X? Esta acción no se puede deshacer."
3. Si el equipo está en partida activa: el servidor responde 409 → mostrar aviso adicional: "Este equipo participa en una partida activa. Eliminarlo puede causar problemas. ¿Deseas continuar?" con botón de confirmación forzada.

> **TODO**: definir si la eliminación forzada (equipo en partida activa) se implementa en MVP o solo se muestra el aviso y se bloquea. Por defecto en MVP: **bloquear** con mensaje explicativo (no permitir eliminación de equipo en partida activa).

---

## 6. Tipos TypeScript

```typescript
// src/types/api.ts

export interface TeamResponse {
  id: string;
  nombre: string;
  agentId: string;
  usuarioId: string;
  estado: TeamStatus;     // 'registrado' | 'activo' | 'finalizado'
  createdAt: string;      // ISO string
}

export interface CreateTeamRequest {
  nombre: string;
  agentId: string;
}

export interface UpdateTeamRequest {
  nombre?: string;
  agentId?: string;
  estado?: TeamStatus;    // Solo Admin; no expuesto en formulario UI
}
```

```typescript
// src/types/domain.ts

export type TeamStatus = 'registrado' | 'activo' | 'finalizado';
```

---

## 7. Gaps y trabajo pendiente

Los siguientes gaps han sido identificados al contrastar la implementación actual con la spec:

| # | Archivo | Gap | Prioridad |
|---|---|---|---|
| G-01 | `src/app/api/teams/route.ts` — `GET` | No filtra por rol: devuelve todos los equipos sin verificar si el usuario es Admin o Equipo. Debe devolver solo el equipo propio para rol `equipo`. | Alta |
| G-02 | `src/app/api/teams/route.ts` — `GET` | No requiere sesión: cualquier usuario no autenticado puede listar todos los equipos. Añadir guard `if (!session?.user) return 401`. | Alta |
| G-03 | `src/app/api/teams/[id]/route.ts` — `PUT` | No verifica que el rol sea `admin`. Un usuario `equipo` autenticado puede editar el equipo de otro. | Alta |
| G-04 | `src/app/api/teams/[id]/route.ts` — `GET` | No verifica que el equipo `[id]` pertenezca al usuario si el rol es `equipo`. | Media |
| G-05 | `src/app/api/teams/[id]/route.ts` — `DELETE` | No comprueba si el equipo está activo en una partida en curso. Eliminar podría dejar la partida en estado inconsistente. | Alta |
| G-06 | `src/app/api/teams/route.ts` — `POST` | Error de nombre duplicado retorna 409 en lugar de 400. La spec define 400 `NOMBRE_DUPLICADO`. Homogeneizar códigos de respuesta. | Baja |
| G-07 | `src/app/equipo/registro/page.tsx` | Tras registro exitoso no refresca el `SessionContext`. Dependiendo del comportamiento de `router.push`, el `equipo` en el contexto puede estar vacío hasta el siguiente ciclo. Añadir `router.refresh()` o invalidación explícita. | Media |
| G-08 | `src/app/equipo/page.tsx` | Estado vacío de partidas no implementado: si `games` es array vacío, no se muestra mensaje explicativo. | Baja |
| G-09 | UI Admin | No existe aún la sección de gestión de equipos en `/admin`. Pendiente de implementar `AdminTeamsSection`. | Alta |

---

## 8. Plan de implementación

### Fase 1 — Correcciones en API (gaps críticos)

| Tarea | Archivo | Gap |
|---|---|---|
| Añadir auth guard en `GET /api/teams` | `src/app/api/teams/route.ts` | G-02 |
| Filtrar por rol en `GET /api/teams` | `src/app/api/teams/route.ts` | G-01 |
| Añadir verificación `rol === 'admin'` en `PUT` | `src/app/api/teams/[id]/route.ts` | G-03 |
| Añadir verificación ownership en `GET :id` para rol `equipo` | `src/app/api/teams/[id]/route.ts` | G-04 |
| Añadir comprobación de partida activa en `DELETE` | `src/app/api/teams/[id]/route.ts` | G-05 |

### Fase 2 — Mejoras en UI existente

| Tarea | Archivo | Gap |
|---|---|---|
| Añadir `router.refresh()` tras registro exitoso | `src/app/equipo/registro/page.tsx` | G-07 |
| Implementar estado vacío en sección de partidas | `src/app/equipo/page.tsx` | G-08 |
| Mejorar texto de ayuda para `agent_id` | `src/app/equipo/registro/page.tsx` | — |

### Fase 3 — Gestión Admin (nueva funcionalidad)

| Tarea | Archivo |
|---|---|
| Crear `AdminTeamsSection` component | `src/components/admin/AdminTeamsSection.tsx` |
| Implementar edición inline con `PUT /api/teams/:id` | `src/components/admin/EditTeamRow.tsx` |
| Implementar confirm dialog para eliminación | `src/components/admin/DeleteTeamButton.tsx` |
| Integrar `AdminTeamsSection` en `/admin/page.tsx` | `src/app/admin/page.tsx` |

---

## 9. Trazabilidad

| FR | UI | API | Componente | Schema |
|---|---|---|---|---|
| FR-002 | UI-002 | API-006 (`POST /api/teams`) | `TeamRegistrationPage` | `TeamRegistrationSchema` |
| FR-002 | UI-003 | API-005b (`GET /api/teams/:id`) | `EquipoPage` | — |
| FR-003 | UI-006 | API-005 (`GET /api/teams`) | `AdminTeamsSection` | — |
| FR-003 | UI-006 | API-007 (`PUT /api/teams/:id`) | `EditTeamRow` | `UpdateTeamSchema` |
| FR-003 | UI-006 | API-008 (`DELETE /api/teams/:id`) | `DeleteTeamButton` | — |

---

## 10. Seguridad

| Control | Implementación |
|---|---|
| Autenticación en todos los endpoints | `auth()` en cada Route Handler; 401 si sin sesión |
| RBAC explícito en PUT y DELETE | Verificar `session.user.rol === 'admin'` en handler |
| RBAC en GET /api/teams | Filtrar por `usuarioId` si rol `equipo` |
| RBAC en GET /api/teams/:id | Verificar ownership si rol `equipo` |
| Validación de entrada | `TeamRegistrationSchema` / `UpdateTeamSchema` Zod; 422 con detalle |
| Unicidad de nombre | Restricción `UNIQUE` en BD + comprobación previa con mensaje de error amigable |
| Protección de datos | `DELETE` bloqueado si equipo en partida activa; el Admin siempre ve todos los equipos pero nunca `cartas` de un equipo que no esté en partida finalizada |
| No hay datos sensibles en el equipo | `agent_id` no es un secreto de seguridad; es un identificador no confidencial del agente |

---

## 11. Decisiones tomadas

| Decisión | Motivo |
|---|---|
| Un usuario → máximo un equipo | Regla de negocio RB-001; simplifica gestión del evento |
| Nombre único en todo el evento | Evita confusiones en ranking y vista de partida; restricción a nivel BD (UNIQUE) |
| El estado del equipo lo gestiona el motor | `active`/`finalizado` lo transiciona `engine.ts`; la UI solo puede leer el estado, no modificarlo directamente |
| No hay "editar equipo" para el rol Equipo | El participante no puede cambiar su `agent_id` una vez registrado (evita cambios tardíos que afecten a partidas en curso); si necesita cambio, contacta al Admin |
| Eliminación bloqueada si equipo activo | Eliminar un equipo en partida activa dejaría la partida en estado inconsistente. En MVP, se bloquea con mensaje. |
| Sin período de registro configurable en MVP | El Admin controla el ciclo manualmente (cierra el registro eliminando/ocultando el acceso si necesario); sin flag de configuración en MVP para simplificar |

---

## 12. Fuentes

| URL | Fecha | Qué se extrajo |
|---|---|---|
| Spec interna: [10-requisitos-funcionales.md](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) | 2026-02-26 | FR-002 y FR-003: criterios de aceptación, flujos y validaciones |
| Spec interna: [20-conceptualizacion.md](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) | 2026-02-26 | FLW-001 (registro de equipo), RB-001, RB-002, entidades |
| Spec interna: [30-ui-spec.md](../../clue-arena-spec/docs/spec/30-ui-spec.md) | 2026-02-26 | UI-002, UI-003, UI-006: estados, navegación, polling |
| Spec interna: [60-backend.md](../../clue-arena-spec/docs/spec/60-backend.md) | 2026-02-26 | API-005..008: contrato de endpoints, errores, validaciones |
