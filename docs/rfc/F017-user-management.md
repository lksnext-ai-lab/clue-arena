# RFC F017 — Gestión de Usuarios: Aprovisionamiento, Bootstrap y Panel Admin

| Campo | Valor |
|---|---|
| **ID** | F017 |
| **Título** | Gestión de usuarios: provisioning en login, bootstrap admin y panel de administración |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-03-03 |
| **Refs. spec** | [00-context](../../clue-arena-spec/docs/spec/00-context.md) · [80-seguridad](../../clue-arena-spec/docs/spec/80-seguridad.md) · [20-conceptualizacion §roles](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) |
| **Deps.** | RFC F001 · RFC F002 · RFC F005 |

---

## 1. Resumen

Este RFC define el diseño e implementación de la **gestión completa del ciclo de vida de usuarios** en Clue Arena, que cubre tres carencias actuales:

1. **Dev mode roto**: con `DISABLE_AUTH=true` los Route Handlers fallan en DB vacía porque los usuarios ficticios (`DEV_USERS`) no existen en la tabla `usuarios`.
2. **Sin bootstrap de admin**: en producción todos los usuarios se auto-provisionan con `rol: 'equipo'`; no existe mecanismo para crear el primer administrador sin acceso directo a la BD.
3. **Sin panel de gestión**: no hay UI ni API para que un admin cambie roles, liste o elimine usuarios.

El resultado final es:

- Comando `db:seed` que inserta los usuarios dev en la BD cuando `DISABLE_AUTH=true`.
- Variable de entorno `BOOTSTRAP_ADMIN_EMAIL`: el primer login con ese email recibe `rol: 'admin'` automáticamente.
- Cambio del rol por defecto en provisioning: `'equipo'` → `'espectador'` (un admin promueve explícitamente a los participantes).
- API REST completa: `GET /api/users`, `GET|PUT|DELETE /api/users/[id]`.
- UI-009: panel `/admin/users` para listar y editar roles de usuarios.

---

## 2. Diagnóstico del problema actual

### 2.1 Flujo roto en dev mode (`DISABLE_AUTH=true`)

```
Usuario accede a /equipo/registro
  → POST /api/teams
    → getAuthSession() devuelve mock { email: 'dev-equipo@clue-arena.local', id: 'dev-equipo-id' }
    → db.select().from(usuarios).where(eq(usuarios.email, mock.email)).get()
    → resultado: undefined   ← DB vacía, el usuario mock no existe
    → return 404 "Usuario no encontrado"
```

**Causa directa**: `src/lib/auth/session.ts` devuelve usuarios ficticios; `src/lib/auth/dev.ts` define
`DEV_USERS` con emails/ids que nunca se insertan en la BD.

### 2.2 Sin bootstrap de admin en producción

```
Usuario hace login OIDC (primer acceso, BD vacía)
  → signIn callback en src/lib/auth/config.ts
    → usuario no existe → INSERT con rol: 'equipo'   ← siempre
  → Nadie tiene rol 'admin'
  → /admin/* inaccesible para todos
  → No hay forma de gestionar usuarios sin acceso directo a la BD (sqlite CLI)
```

**Causa directa**: el callback `signIn` en `config.ts` hardcodea `rol: 'equipo'` para todos los usuarios nuevos, sin excepción.

### 2.3 Sin API de gestión de usuarios

No existe ningún Route Handler en `src/app/api/users/` ni UI en `src/app/admin/users/`. Un admin no puede cambiar el rol de un usuario una vez que éste existe en la BD.

---

## 3. Objetivos

| # | Objetivo | Prioridad |
|---|---|---|
| O1 | Reparar el flujo de dev mode: seed automático de usuarios ficticios | P0 |
| O2 | Bootstrap del primer admin vía `BOOTSTRAP_ADMIN_EMAIL` en producción | P0 |
| O3 | Cambiar rol por defecto de nuevos usuarios a `espectador` | P0 |
| O4 | API REST `/api/users` para gestión de usuarios (solo admin) | P1 |
| O5 | UI-009 — Panel `/admin/users` para listar y editar roles | P1 |

---

## 4. Diseño

### 4.1 Fix dev mode: seed de usuarios ficticios

#### 4.1.1 Script `db:seed`

Añadir script `src/lib/db/seed.ts` que inserte los usuarios de `DEV_USERS` si no existen ya:

```typescript
// src/lib/db/seed.ts
import { db } from './index';
import { usuarios } from './schema';
import { eq } from 'drizzle-orm';
import { DEV_USERS } from '@/lib/auth/dev';

export async function seedDevUsers() {
  for (const [, user] of Object.entries(DEV_USERS)) {
    const existing = await db.select().from(usuarios)
      .where(eq(usuarios.email, user.email)).get();
    if (!existing) {
      await db.insert(usuarios).values({
        id: user.id,
        email: user.email,
        nombre: user.name,
        rol: user.rol,
        createdAt: new Date(),
      });
    }
  }
}
```

Invocarlo al iniciar el servidor en dev:

```typescript
// src/app/api/init/route.ts  (o en src/server.ts si existe)
// O directamente en src/lib/db/index.ts al crear el singleton, solo en dev:
if (process.env.DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
  await seedDevUsers();
}
```

> En `src/server.ts` ya existe un punto de entrada del servidor — es el lugar más adecuado para el seed.

**`package.json` — nuevo script:**

```json
"db:seed": "tsx src/lib/db/seed.ts"
```

#### 4.1.2 Alternativa: seed en `src/lib/db/index.ts`

Otra opción es llamar `seedDevUsers()` de forma lazy al crear el cliente singleton de BD, de modo que no requiera paso manual. Este approach es más simple para DX. Ver sección 4.5 sobre decisión de implementación.

---

### 4.2 Bootstrap del primer admin (`BOOTSTRAP_ADMIN_EMAIL`)

Modificar el callback `signIn` en `src/lib/auth/config.ts`:

```typescript
// src/lib/auth/config.ts — callback signIn actualizado
async signIn({ user }) {
  if (!user.email) return false;

  const existing = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, user.email))
    .get();

  if (!existing) {
    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
    const isBootstrapAdmin =
      bootstrapEmail && user.email.toLowerCase() === bootstrapEmail;

    await db.insert(usuarios).values({
      id: uuidv4(),
      email: user.email,
      nombre: user.name ?? user.email,
      rol: isBootstrapAdmin ? 'admin' : 'espectador',  // ← cambia de 'equipo' a 'espectador'
      createdAt: new Date(),
    });
  }

  return true;
},
```

**Reglas:**
- Si ya existe en BD, **no se modifica el rol** (idempotente).
- Si `BOOTSTRAP_ADMIN_EMAIL` no está definida, todos los nuevos usuarios son `espectador`.
- La variable puede definirse después de desplegar: el admin solo se crea la primera vez que ese email hace login.

**Nueva variable de entorno:**

```bash
# .env.example
BOOTSTRAP_ADMIN_EMAIL=admin@tu-organizacion.com
```

---

### 4.3 Cambio de rol por defecto: `'equipo'` → `'espectador'`

El rol por defecto actual (`'equipo'`) es incorrecto para el modelo del evento:

| Rol | Quién lo tiene | Cómo se asigna |
|---|---|---|
| `admin` | Organizadores | Via `BOOTSTRAP_ADMIN_EMAIL` + promoción manual |
| `equipo` | Participantes competidores | El admin los promueve desde el panel de usuarios |
| `espectador` | Resto de empleados | Auto-asignado en primer login |

Esto implica que el admin debe **promover explícitamente** a los participantes a `rol: 'equipo'` antes de que puedan registrar su equipo. Este flujo es intencional: evita que cualquier empleado que haga login pueda registrar un agente.

---

### 4.4 API REST `/api/users`

#### Endpoints

| Método | Ruta | Rol requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/users` | `admin` | Lista todos los usuarios (paginado, filtrable por rol) |
| `GET` | `/api/users/[id]` | `admin` | Obtiene un usuario por ID |
| `PUT` | `/api/users/[id]` | `admin` | Actualiza nombre y/o rol |
| `DELETE` | `/api/users/[id]` | `admin` | Elimina un usuario |

> No existe `POST /api/users`; el alta siempre es via login OIDC (auto-provisioning).

#### Query params `GET /api/users`

| Param | Tipo | Descripción |
|---|---|---|
| `rol` | `admin\|equipo\|espectador` | Filtrar por rol |
| `q` | string | Búsqueda por nombre o email (LIKE) |
| `page` | number | Página (base 1, default 1) |
| `pageSize` | number | Tamaño de página (default 50, max 200) |

#### Esquema Zod — `src/lib/schemas/user.ts`

```typescript
import { z } from 'zod';

export const UpdateUserSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  rol: z.enum(['admin', 'equipo', 'espectador']).optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
```

#### Reglas de negocio y errores

| Situación | Código HTTP | Body |
|---|---|---|
| No autenticado | 401 | `{ error: 'No autenticado' }` |
| No es admin | 403 | `{ error: 'Prohibido' }` |
| Usuario no encontrado | 404 | `{ error: 'Usuario no encontrado' }` |
| Admin intenta cambiar su propio rol | 403 | `{ code: 'SELF_ROLE_CHANGE', error: 'No puedes cambiar tu propio rol' }` |
| Eliminar el último admin | 409 | `{ code: 'ULTIMO_ADMIN', error: 'No se puede eliminar el último administrador' }` |
| Eliminar usuario con equipo activo | 409 | `{ code: 'USUARIO_CON_EQUIPO', error: 'El usuario tiene un equipo registrado. Elimina el equipo primero.' }` |

#### Estructura de ficheros nuevos

```
src/app/api/users/
├── route.ts          # GET (lista)
└── [id]/
    └── route.ts      # GET (detalle), PUT, DELETE
```

---

### 4.5 UI-009 — Panel `/admin/users`

#### Mapa de pantallas

| Ruta | Descripción |
|---|---|
| `/admin/users` | Lista paginada de usuarios con filtros y acciones inline |

#### Estados de la pantalla

| Estado | Comportamiento |
|---|---|
| Cargando | Skeleton de tabla (5 filas) |
| Vacío | "No hay usuarios registrados" + CTA explicativo |
| Error | `<ErrorBanner>` con mensaje y botón reintentar |
| Con datos | Tabla + filtros + acciones por fila |

#### Tabla de usuarios

| Columna | Descripción |
|---|---|
| Nombre | Nombre del usuario |
| Email | Email corporativo |
| Rol | Select inline (`admin` / `equipo` / `espectador`). Deshabilitado para el propio usuario. |
| Equipo | Nombre del equipo asociado (si existe), o "—" |
| Alta | Fecha de primer login |
| Acciones | Botón eliminar (con confirmación modal) |

#### Restricciones UX

- El usuario autenticado **no puede cambiar su propio rol** (select deshabilitado + tooltip: "No puedes editar tu propio rol").
- El botón de eliminar muestra un modal de confirmación con el nombre del usuario.
- Si el usuario tiene equipo, el modal de confirmación advierte: "Este usuario tiene un equipo. Deberás eliminar el equipo primero."
- Cambio de rol: `PUT /api/users/[id]` on `onChange` del select (con debounce 300 ms + toast de confirmación).

#### Navegación

- Enlace "Usuarios" en `/admin` (panel principal de administración) → `/admin/users`.
- Breadcrumb: Admin → Usuarios.

#### Ficheros nuevos

```
src/app/admin/users/
└── page.tsx          # Server Component (carga inicial SSR) + Client Components para tabla interactiva
```

---

## 5. Diagrama de flujo: primer login en entorno vacío (producción)

```
Usuario → Azure EntraID (OIDC) → callback signIn
                                        │
                           ┌────────────▼────────────┐
                           │ ¿existe en DB?           │
                           └──────────────────────────┘
                              Sí │              │ No
                                 │              ▼
                                 │  ¿email == BOOTSTRAP_ADMIN_EMAIL?
                                 │        Sí │        │ No
                                 │           ▼        ▼
                                 │     rol='admin'  rol='espectador'
                                 │           │        │
                                 │           └────────┘
                                 │      INSERT usuarios
                                 │
                           token.rol = user.rol (via session callback)
                                 │
                    ┌────────────▼────────────────────────┐
                    │  Redirect por rol (login page)      │
                    │  admin      → /admin                │
                    │  equipo     → /equipo               │
                    │  espectador → /ranking              │
                    └─────────────────────────────────────┘
```

---

## 6. Flujo de bootstrap en entorno nuevo

**Paso a paso para un administrador que levanta el sistema desde cero:**

```
1. Copiar .env.example → .env.local
2. Definir BOOTSTRAP_ADMIN_EMAIL=<tu-email-corporativo>
3. npm run db:migrate         ← crea las tablas
4. npm run dev                ← (dev) o npm run build && npm start (prod)
5. Hacer login con el email de BOOTSTRAP_ADMIN_EMAIL
   → se crea usuario con rol='admin' automáticamente
6. Ir a /admin/users
   → promover participantes de 'espectador' a 'equipo'
7. Los participantes ya pueden ir a /equipo/registro y crear su equipo
```

**Para dev mode (`DISABLE_AUTH=true`):**

```
1. npm run db:migrate
2. npm run db:seed            ← inserta DEV_USERS en la BD
3. npm run dev
4. Seleccionar rol en /login (selector UI de dev)
   → sesión mock + usuario real en BD → todo funciona
```

---

## 7. Impacto en ficheros existentes

| Fichero | Tipo de cambio |
|---|---|
| `src/lib/auth/config.ts` | Modificar callback `signIn`: rol por defecto `'espectador'`, lógica `BOOTSTRAP_ADMIN_EMAIL` |
| `src/lib/db/seed.ts` | **Nuevo** — función `seedDevUsers()` |
| `src/lib/schemas/user.ts` | **Nuevo** — `UpdateUserSchema` Zod |
| `src/app/api/users/route.ts` | **Nuevo** — `GET` lista de usuarios |
| `src/app/api/users/[id]/route.ts` | **Nuevo** — `GET`, `PUT`, `DELETE` por ID |
| `src/app/admin/users/page.tsx` | **Nuevo** — UI-009 |
| `src/app/admin/page.tsx` | Añadir enlace a "Usuarios" en el panel admin |
| `src/types/domain.ts` | Añadir/verificar tipo `Usuario` exportado |
| `.env.example` | Añadir `BOOTSTRAP_ADMIN_EMAIL=` |
| `package.json` | Añadir script `"db:seed"` |

---

## 8. Preguntas abiertas

| ID | Pregunta | Impacto | Bloquea |
|---|---|---|---|
| OPENQ-F017-01 | ¿Qué ocurre con los equipos asociados a un usuario eliminado? ¿Cascada o error 409? | Consistencia de datos | `DELETE /api/users/[id]` |
| OPENQ-F017-02 | ¿Debe el seed dev insertarse automáticamente al arrancar el servidor (en `db/index.ts`) o requerir `npm run db:seed` explícito? | DX vs control explícito | Implementación seed |
| OPENQ-F017-03 | Cambiar el rol por defecto a `espectador` rompe el flujo actual de quien ya tiene usuarios en BD con `rol: 'equipo'` por el antiguo default. ¿Requiere migración de datos? | Compatibilidad backward | No para nuevo entorno; sí si hay datos existentes |
| OPENQ-F017-04 | ¿El cambio de rol en la tabla debe disparar invalidación del JWT del usuario afectado? Con JWT strategy, el rol del token queda cacheado hasta que expire. | Seguridad / UX | Sesiones activas durante cambio de rol |

---

## 9. Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| RISK-F017-01 | `BOOTSTRAP_ADMIN_EMAIL` no configurada → BD vacía sin ningún admin posible | Warning en arranque del servidor si `usuarios` table está vacía y `BOOTSTRAP_ADMIN_EMAIL` no está definida |
| RISK-F017-02 | Borrado accidental del único admin → sistema sin administrador | Validar en `DELETE /api/users/[id]`: contar admins; rechazar si quedaría 0 |
| RISK-F017-03 | Race condition en provisioning: dos requests simultáneas crean el mismo usuario | Usar `INSERT OR IGNORE` / Drizzle `onConflictDoNothing()` en `signIn` |
| RISK-F017-04 | JWT cacheado con rol antiguo tras cambio de rol por admin | Documentar limitación: el usuario debe hacer logout/login para que el nuevo rol se refleje. Considerar TTL de sesión corto (1h) |
| RISK-F017-05 | Dev seed sobrescribe IDs en BD con datos de partidas ya creadas (en entornos de test persistentes) | Seed usa `INSERT OR IGNORE`; no sobreescribe si ya existen |

---

## 10. Plan de implementación

| Paso | Tarea | Fichero(s) | Prioridad |
|---|---|---|---|
| 1 | Modificar `signIn` callback: rol `'espectador'` + `BOOTSTRAP_ADMIN_EMAIL` | `src/lib/auth/config.ts` | **P0** |
| 2 | Añadir `BOOTSTRAP_ADMIN_EMAIL` a `.env.example` | `.env.example` | **P0** |
| 3 | Crear `src/lib/db/seed.ts` con `seedDevUsers()` | `src/lib/db/seed.ts` | **P0** |
| 4 | Integrar seed en arranque dev (decidir OPENQ-F017-02) | `src/server.ts` o `src/lib/db/index.ts` | **P0** |
| 5 | Añadir script `"db:seed"` en `package.json` | `package.json` | **P0** |
| 6 | Crear `UpdateUserSchema` en `src/lib/schemas/user.ts` | `src/lib/schemas/user.ts` | P1 |
| 7 | Implementar `GET /api/users` | `src/app/api/users/route.ts` | P1 |
| 8 | Implementar `GET + PUT + DELETE /api/users/[id]` | `src/app/api/users/[id]/route.ts` | P1 |
| 9 | Construir UI-009 (`/admin/users`) | `src/app/admin/users/page.tsx` | P1 |
| 10 | Añadir enlace "Usuarios" en `/admin` | `src/app/admin/page.tsx` | P1 |
| 11 | Tests unitarios: provisioning, seed, Route Handlers | `src/tests/` | P2 |

> **P0** desbloquea el entorno vacío (dev y producción). **P1** habilita la gestión completa en UI. **P2** garantiza calidad.

---

## 11. Alternativas descartadas

| Alternativa | Razón de descarte |
|---|---|
| Seed manual via `sqlite3` CLI | No reproducible, no documentable, no apto para CI/CD |
| Rol por defecto `'admin'` para el primer usuario | Cualquier usuario de la organización que haga login antes que el admin real obtendría privilegios de administrador |
| Invitaciones por email | Complejidad desproporcionada para un evento puntual con equipo unipersonal |
| Mantener rol por defecto `'equipo'` | Permite que cualquier empleado autenticado registre un agente sin aprobación del organizador |
| JWT con invalidación inmediata al cambiar rol | Requiere token blocklist o session store; incompatible con el objetivo de simplicidad del MVP |
