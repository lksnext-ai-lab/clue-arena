# RFC F010 — Elementos del Juego: Personajes, Armas y Escenarios

| Campo | Valor |
|---|---|
| **ID** | F010 |
| **Título** | Definición canónica y alineación de elementos del juego: sospechosos, armas y escenarios |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-27 |
| **Refs. spec** | [00-context](../../clue-arena-spec/docs/spec/00-context.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [10-requisitos-funcionales](../../clue-arena-spec/docs/spec/10-requisitos-funcionales.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) |
| **Deps.** | RFC F001 · RFC F003 · RFC F007 |
| **Impacto** | `src/types/domain.ts` · `src/lib/game/engine.ts` · `src/lib/game/types.ts` · `src/lib/mcp/tools/` · `src/tests/game-engine.test.ts` · `src/components/game/juego/` · documentación |

---

## 1. Resumen

Este RFC establece la **definición canónica y temáticamente consistente** de los 21 elementos del juego Cluedo en el contexto del evento *"El Algoritmo Asesinado"*: 6 sospechosos, 6 armas y 9 escenarios. Define también los puntos de la implementación donde estos elementos deben estar presentes y actualmente presentan inconsistencias.

El objetivo es que personajes, armas y escenarios reflejen la **temática corporativa/tecnológica** del evento en toda la implementación: tipos TypeScript, motor de juego, herramientas MCP, tests y componentes de UI.

---

## 2. Motivación: inventario de inconsistencias detectadas

### 2.1 Inconsistencia principal: escenarios

Los assets de imagen en `public/game/escenarios/` tienen **nombres corporativos** que no coinciden con las constantes de código en `src/types/domain.ts` (nombres clásicos del Cluedo de mesa):

| Asset en `public/game/escenarios/` | Constante actual en `HABITACIONES` |
|---|---|
| `el-despacho-del-ceo.png` | `'Estudio'` |
| `el-laboratorio.png` | `'Conservatorio'` (aprox.) |
| `el-open-space.png` | `'Sala de billar'` (aprox.) |
| `la-cafeteria.png` | `'Cocina'` (aprox.) |
| `la-sala-de-juntas.png` | `'Comedor'` (aprox.) |
| `la-sala-de-servidores.png` | *(sin equivalente claro)* |
| `la-zona-de-descanso.png` | `'Sala de estar'` (aprox.) |
| `recursos-humanos.png` | *(sin equivalente claro)* |
| `el-almacen-de-it.png` | `'Vestíbulo'` (aprox.) |

Resultado: la UI de escenarios (RFC F003, `JuegoEscenarios`) muestra nombres clásicos pero assets corporativos. **Los agentes IA que usen los nombres de habitación del `get_game_state` no podrán relacionarlos con los assets visuales que ven los espectadores.**

### 2.2 Inconsistencia secundaria: sospechosos

Los 6 sospechosos están definidos con **nombres corporativos propios del evento** que difieren de los nombres del Cluedo clásico. Sin embargo, el código actual en `src/types/domain.ts` usa los nombres clásicos (`'Coronel Mostaza'`, `'Señora Pavo Real'`, etc.), que no coinciden con los nombres oficiales del evento ni con los assets de imagen.

**Decisión**: los sospechosos usan los **nombres corporativos canónicos** del evento en toda la implementación (motor, MCP, datos, UI). Son nombres compuestos que mezclan título en español y apellido en inglés para reforzar la identidad del evento. El campo `departamento` reemplaza al antiguo `rolCorporativo`.

### 2.3 Inconsistencia terciaria: armas

Las 6 armas usan nombres del Cluedo clásico (`'Candelabro'`, `'Cuchillo'`, etc.) en toda la implementación actual. Sin embargo, el evento tiene **nombres corporativos propios** para las armas, al igual que para los sospechosos.

**Decisión**: las armas adoptan los **nombres corporativos canónicos** del evento en todos los niveles (motor, MCP, datos, UI). No se usa ningún nombre clásico del Cluedo para las armas en ninguna capa. El concepto de *alias* desaparece — el nombre canónico ya es el corporativo.

> **Simetría con sospechosos y escenarios**: al igual que éstos, las armas tienen nombres definidos por el brief del evento que reemplazan completamente a los términos del Cluedo clásico.

---

## 3. Definición canónica de elementos

### 3.1 Sospechosos (6) — nombres corporativos canónicos

Los nombres **canónicos** (usados en motor, MCP, datos y UI) son los corporativos del evento. **Estos son los únicos nombres válidos en toda la implementación** — no se usan los nombres clásicos del Cluedo de mesa en ninguna capa.

| ID | Nombre canónico | Color | Departamento |
|---|---|---|---|
| S-01 | `Directora Scarlett` | `#ef4444` (rojo) | Marketing |
| S-02 | `Coronel Mustard` | `#eab308` (amarillo) | Seguridad |
| S-03 | `Sra. White` | `#e2e8f0` (blanco) | Administración |
| S-04 | `Sr. Green` | `#22c55e` (verde) | Finanzas |
| S-05 | `Dra. Peacock` | `#3b82f6` (azul) | Legal |
| S-06 | `Profesor Plum` | `#a855f7` (púrpura) | Innovación |

**Constante canónica actualizada** (reemplaza los nombres clásicos en `src/types/domain.ts`):

```typescript
export const SOSPECHOSOS = [
  'Directora Scarlett',
  'Coronel Mustard',
  'Sra. White',
  'Sr. Green',
  'Dra. Peacock',
  'Profesor Plum',
] as const;
```

---

### 3.2 Armas (6) — nombres corporativos canónicos

Los nombres **canónicos** (usados en motor, MCP, datos y UI) son los corporativos del evento. **No se usan los nombres del Cluedo clásico en ninguna capa.**

| ID | Nombre canónico | Emoji |
|---|---|---|
| A-01 | `Cable de red` | `🔌` |
| A-02 | `Teclado mecánico` | `⌨️` |
| A-03 | `Cafetera rota` | `🫖` |
| A-04 | `Certificado SSL caducado` | `🔒` |
| A-05 | `Grapadora industrial` | `📎` |
| A-06 | `Termo de acero` | `🥤` |

**Constante canónica actualizada** (reemplaza los nombres clásicos en `src/types/domain.ts`):

```typescript
export const ARMAS = [
  'Cable de red',
  'Teclado mecánico',
  'Cafetera rota',
  'Certificado SSL caducado',
  'Grapadora industrial',
  'Termo de acero',
] as const;
```

---

### 3.3 Escenarios / Habitaciones (9) — nombres corporativos canónicos

> Los nombres de `HABITACIONES` se reemplazan por los nombres corporativos alineados con los assets de imagen existentes en `public/game/escenarios/`.

| ID | Nombre canónico **nuevo** | Asset de imagen | Reemplaza a (nombre clásico) | Emoji |
|---|---|---|---|---|
| H-01 | `El Despacho del CEO` | `el-despacho-del-ceo.png` | `Estudio` | `💼` |
| H-02 | `El Laboratorio` | `el-laboratorio.png` | `Conservatorio` | `🔬` |
| H-03 | `El Open Space` | `el-open-space.png` | `Sala de billar` | `💻` |
| H-04 | `La Cafetería` | `la-cafeteria.png` | `Cocina` | `☕` |
| H-05 | `La Sala de Juntas` | `la-sala-de-juntas.png` | `Comedor` | `📊` |
| H-06 | `La Sala de Servidores` | `la-sala-de-servidores.png` | `Biblioteca` | `🖥️` |
| H-07 | `La Zona de Descanso` | `la-zona-de-descanso.png` | `Sala de estar` | `🛋️` |
| H-08 | `Recursos Humanos` | `recursos-humanos.png` | `Vestíbulo` | `👥` |
| H-09 | `El Almacén de IT` | `el-almacen-de-it.png` | `Salón de baile` | `📦` |

**Constante canónica actualizada:**

```typescript
export const HABITACIONES = [
  'El Despacho del CEO',
  'El Laboratorio',
  'El Open Space',
  'La Cafetería',
  'La Sala de Juntas',
  'La Sala de Servidores',
  'La Zona de Descanso',
  'Recursos Humanos',
  'El Almacén de IT',
] as const;
```

> **Nota**: El nombre de cada habitación es la descripción de la imagen que lleva ese nombre. No es necesario ningún metadato adicional para habitaciones en la capa de presentación.

---

## 4. Inventario de ficheros afectados por el cambio de HABITACIONES

Los cambios en `SOSPECHOSOS`, `ARMAS` y `HABITACIONES` son **cambios de string constante**; TypeScript con `strict: true` propagará los errores de tipo a todos los puntos de uso. Los ficheros afectados son:

### 4.1 Tipos y constantes

| Fichero | Cambio requerido |
|---|---|
| `src/types/domain.ts` | Reemplazar los 6 valores en `SOSPECHOSOS`, los 6 valores en `ARMAS` y los 9 valores en `HABITACIONES` por los nombres corporativos del evento. |

### 4.2 Motor de juego

| Fichero | Impacto |
|---|---|
| `src/lib/game/engine.ts` | Sin cambio de lógica. Los nombres son strings; el motor opera sobre ellos de forma genérica. |
| `src/lib/game/types.ts` | Sin cambio. `Habitacion` es `(typeof HABITACIONES)[number]`; se actualiza automáticamente. |

### 4.3 Herramientas MCP

| Fichero | Cambio requerido |
|---|---|
| `src/lib/mcp/tools/make-suggestion.ts` | Actualizar validación Zod si tiene enum explícito de habitaciones. |
| `src/lib/mcp/tools/make-accusation.ts` | Ídem. |
| `src/lib/mcp/tools/get-game-state.ts` | Verificar que el campo `room` en la respuesta usa los nuevos nombres. |

### 4.4 Tests

| Fichero | Cambio requerido |
|---|---|
| `src/tests/game-engine.test.ts` | Reemplazar literales de habitaciones clásicas (`'Cocina'`) por nombres corporativos (`'La Cafetería'`). |
| `src/tests/` (otros tests) | Revisar cualquier literal de habitación. |

### 4.5 Componentes UI

| Fichero | Cambio requerido |
|---|---|
| `src/components/game/juego/JuegoEscenarios.tsx` | Actualizar `HABITACION_ICONOS` con los nuevos nombres. Añadir mapeo `nombre → asset image`. |
| Otros componentes que referencien habitaciones por literal | Revisar con `grep -r "Cocina\|Salón de baile\|Conservatorio\|Comedor\|Sala de billar\|Biblioteca\|Sala de estar\|Vestíbulo" src/` |

### 4.6 Documentación / RFC

| Fichero | Cambio requerido |
|---|---|
| `docs/rfc/F003-game-description.md` (§3.6 y §6.7) | Actualizar tabla de escenarios y constante `HABITACION_ICONOS`. |
| `docs/rfc/F003-game-description.md` (§3.5, personajes) | Añadir columna "Rol corporativo". |
| `docs/rfc/F003-game-description.md` (§3.4, armas) | Añadir columna "Alias corporativo". |

---

## 5. Especificación de cambios de implementación

### 5.1 `src/types/domain.ts` — SOSPECHOSOS y HABITACIONES

```typescript
// ANTES — sospechosos clásicos
export const SOSPECHOSOS = [
  'Coronel Mostaza',
  'Señora Pavo Real',
  'Reverendo Verde',
  'Señora Escarlata',
  'Profesor Ciruela',
  'Señorita Amapola',
] as const;

// DESPUÉS — sospechosos corporativos del evento
export const SOSPECHOSOS = [
  'Directora Scarlett',
  'Coronel Mustard',
  'Sra. White',
  'Sr. Green',
  'Dra. Peacock',
  'Profesor Plum',
] as const;

// ANTES — armas clásicas
export const ARMAS = [
  'Candelabro',
  'Cuchillo',
  'Tubo de plomo',
  'Revólver',
  'Cuerda',
  'Llave inglesa',
] as const;

// DESPUÉS — armas corporativas del evento
export const ARMAS = [
  'Cable de red',
  'Teclado mecánico',
  'Cafetera rota',
  'Certificado SSL caducado',
  'Grapadora industrial',
  'Termo de acero',
] as const;
```

```typescript
// ANTES — habitaciones clásicas
export const HABITACIONES = [
  'Cocina',
  'Salón de baile',
  'Conservatorio',
  'Comedor',
  'Sala de billar',
  'Biblioteca',
  'Sala de estar',
  'Estudio',
  'Vestíbulo',
] as const;

// DESPUÉS — habitaciones corporativas alineadas con assets
export const HABITACIONES = [
  'El Despacho del CEO',
  'El Laboratorio',
  'El Open Space',
  'La Cafetería',
  'La Sala de Juntas',
  'La Sala de Servidores',
  'La Zona de Descanso',
  'Recursos Humanos',
  'El Almacén de IT',
] as const;
```

El tipo `Habitacion` es `(typeof HABITACIONES)[number]`, por lo que **no requiere cambio manual** — TypeScript lo inferirá automáticamente.

---

### 5.2 `src/types/domain.ts` — Metadatos de UI (solo presentación)

Añadir metadatos de UI como constantes independientes (no usadas por el motor ni MCP):

```typescript
// ── Metadatos de UI: solo para capa de presentación ──────────────────────────
// NO importar en engine.ts, MCP tools ni route handlers

export interface PersonajeMeta {
  color: string;        // HEX para dot y borde de ficha
  departamento: string; // Departamento corporativo del personaje
  descripcion: string;
}

export const PERSONAJE_META: Record<Sospechoso, PersonajeMeta> = {
  'Directora Scarlett': { color: '#ef4444', departamento: 'Marketing',      descripcion: 'Directora de Marketing con acceso a todos los sistemas de comunicación internos.' },
  'Coronel Mustard':    { color: '#eab308', departamento: 'Seguridad',      descripcion: 'Responsable de seguridad corporativa. Nadie entra sin que él lo sepa.' },
  'Sra. White':         { color: '#e2e8f0', departamento: 'Administración', descripcion: 'Administra la empresa desde las sombras. Sabe más de lo que dice.' },
  'Sr. Green':          { color: '#22c55e', departamento: 'Finanzas',       descripcion: 'Controla los presupuestos de IT. Tiene motivos económicos para actuar.' },
  'Dra. Peacock':       { color: '#3b82f6', departamento: 'Legal',          descripcion: 'Asesora jurídica que conoce cada contrato y cada cláusula del sistema.' },
  'Profesor Plum':      { color: '#a855f7', departamento: 'Innovación',     descripcion: 'Creador del algoritmo asesinado. El primero en saber que algo ha ido terriblemente mal.' },
};

export interface ArmaMeta {
  emoji: string;
}

export const ARMA_META: Record<Arma, ArmaMeta> = {
  'Cable de red':                { emoji: '🔌' },
  'Teclado mecánico':            { emoji: '⌨️' },
  'Cafetera rota':               { emoji: '🫖' },
  'Certificado SSL caducado':    { emoji: '🔒' },
  'Grapadora industrial':        { emoji: '📎' },
  'Termo de acero':              { emoji: '🥤' },
};

export interface EscenarioMeta {
  imagen: string;   // Ruta relativa a /public/game/escenarios/
  emoji: string;
}

export const ESCENARIO_META: Record<Habitacion, EscenarioMeta> = {
  'El Despacho del CEO':    { imagen: '/game/escenarios/el-despacho-del-ceo.png',    emoji: '💼' },
  'El Laboratorio':         { imagen: '/game/escenarios/el-laboratorio.png',         emoji: '🔬' },
  'El Open Space':          { imagen: '/game/escenarios/el-open-space.png',          emoji: '💻' },
  'La Cafetería':           { imagen: '/game/escenarios/la-cafeteria.png',           emoji: '☕' },
  'La Sala de Juntas':      { imagen: '/game/escenarios/la-sala-de-juntas.png',      emoji: '📊' },
  'La Sala de Servidores':  { imagen: '/game/escenarios/la-sala-de-servidores.png',  emoji: '🖥️' },
  'La Zona de Descanso':    { imagen: '/game/escenarios/la-zona-de-descanso.png',    emoji: '🛋️' },
  'Recursos Humanos':       { imagen: '/game/escenarios/recursos-humanos.png',       emoji: '👥' },
  'El Almacén de IT':       { imagen: '/game/escenarios/el-almacen-de-it.png',       emoji: '📦' },
};
```

> **Regla de importación**: `PERSONAJE_META`, `ARMA_META` y `ESCENARIO_META` solo deben importarse en componentes de `src/components/` y en `src/app/` (rutas de página). **Nunca** en `src/lib/game/engine.ts`, `src/lib/mcp/tools/` ni route handlers.

---

### 5.3 Herramientas MCP — validación Zod

Si `make-suggestion.ts` o `make-accusation.ts` tienen enums explícitos de habitación, deben usar `HABITACIONES` importado de `@/types/domain`:

```typescript
// src/lib/mcp/tools/make-suggestion.ts  (y make-accusation.ts)
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';

// Ejemplo de schema Zod derivado de las constantes canónicas:
const SuggestionInput = z.object({
  game_id:  z.string(),
  team_id:  z.string(),
  suspect:  z.enum(SOSPECHOSOS),
  weapon:   z.enum(ARMAS),
  room:     z.enum(HABITACIONES),   // ahora validará nombres corporativos
});
```

Esto garantiza que el motor MCP rechaza valores fuera del conjunto canónico y que cualquier cambio futuro en las constantes se propaga automáticamente.

---

### 5.4 `src/tests/game-engine.test.ts` — literales hardcoded

Los literales de sospechosos y habitaciones clásicas deben sustituirse por nombres corporativos:

```typescript
// ANTES
const action: SuggestionAction = {
  type: 'suggestion',
  equipoId: 'team-a',
  sospechoso: 'Coronel Mostaza',        // ← nombre clásico
  arma: 'Cuchillo',                     // ← nombre clásico
  habitacion: 'Cocina',                 // ← nombre clásico
};

// DESPUÉS
const action: SuggestionAction = {
  type: 'suggestion',
  equipoId: 'team-a',
  sospechoso: 'Coronel Mustard',        // ← nombre corporativo
  arma: 'Teclado mecánico',             // ← nombre corporativo
  habitacion: 'La Cafetería',           // ← nombre corporativo
};

// También actualizar los literales en test de acusación incorrecta:
// ANTES: ['Coronel Mostaza', 'Señora Pavo Real', 'Reverendo Verde'].find(...)
// DESPUÉS: ['Directora Scarlett', 'Coronel Mustard', 'Sra. White'].find(...)
```

---

### 5.5 `src/components/game/juego/JuegoEscenarios.tsx`

```tsx
// ANTES
const HABITACION_ICONOS: Record<string, string> = {
  'Cocina':           '🍳',
  'Salón de baile':   '🎭',
  // ...
};

// DESPUÉS — usar ESCENARIO_META de domain.ts
import { HABITACIONES, ESCENARIO_META } from '@/types/domain';
import Image from 'next/image';

// En el componente:
{HABITACIONES.map((habitacion) => {
  const meta = ESCENARIO_META[habitacion];
  return (
    <div key={habitacion} className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="relative h-24">
        <Image
          src={meta.imagen}
          alt={habitacion}
          fill
          className="object-cover"
          loading="lazy"
          quality={70}
        />
      </div>
      <div className="p-2 flex flex-col items-center text-center">
        <span className="text-lg">{meta.emoji}</span>
        <span className="text-xs font-medium text-slate-300 mt-1 leading-tight">{habitacion}</span>
      </div>
    </div>
  );
})}
```

---

### 5.6 `src/components/game/juego/JuegoPersonajes.tsx`

```tsx
// ANTES — metadatos hardcoded con nombres clásicos del Cluedo
const PERSONAJE_META: Record<string, { color: string; descripcion: string }> = {
  'Coronel Mostaza':   { color: '#eab308', descripcion: 'Militar retirado...' },
  // ...
};

// DESPUÉS — importar de domain.ts (nombres corporativos canónicos)
import { SOSPECHOSOS, PERSONAJE_META } from '@/types/domain';

// En el renderizado de cada ficha:
{SOSPECHOSOS.map((nombre) => {
  const meta = PERSONAJE_META[nombre];
  return (
    <div key={nombre} className="bg-slate-800/60 border rounded-lg p-3"
         style={{ borderColor: `${meta.color}66` }}>
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
      <p className="text-xs font-semibold text-white mt-2">{nombre}</p>
      <p className="text-[10px] text-cyan-400/80 mt-0.5 font-medium">{meta.departamento}</p>
      <p className="text-xs text-slate-500 mt-1 leading-tight">{meta.descripcion}</p>
    </div>
  );
})}
```

---

### 5.7 `src/components/game/juego/JuegoArmas.tsx`

```tsx
// ANTES — metadatos hardcoded con nombres clásicos del Cluedo
const ARMA_ICONOS: Record<string, string> = {
  'Candelabro': '🕯️',
  // ...
};

// DESPUÉS — importar de domain.ts (nombres corporativos canónicos)
import { ARMAS, ARMA_META } from '@/types/domain';

{ARMAS.map((arma) => {
  const meta = ARMA_META[arma];
  return (
    <div key={arma} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 flex flex-col items-center text-center">
      <span className="text-2xl">{meta.emoji}</span>
      <p className="text-xs font-semibold text-white mt-2">{arma}</p>
    </div>
  );
})}
```

---

## 6. Propagación en la capa de datos

Los nombres de habitación se almacenan como strings en:

- `ENT-005 (Sobre)`: campos `personaje`, `arma`, `habitacion`.
- `ENT-007 (Sugerencia)`: campos `personaje`, `arma`, `habitacion`.
- `ENT-008 (Acusacion)`: campos `personaje`, `arma`, `habitacion`.
- `PartidaEquipo.cartas`: JSON array de `Carta` (que incluye `Habitacion`).

**Implicación**: si la base de datos ya contiene datos de prueba con nombres clásicos, esos registros son incompatibles con los nuevos nombres. Dado que el proyecto está en fase de desarrollo sin datos de producción, se debe ejecutar `npm run db:migrate` (o borrar y recrear la BD de dev) tras el cambio.

> **Nota para el esquema Drizzle** (`src/lib/db/schema.ts`): los campos de habitación son `text('habitacion')` sin enum Drizzle. No se requiere migración de schema, solo de datos de prueba existentes.

---

## 7. Compatibilidad con los agentes IA (MCP)

Cuando los agentes IA invoquen `make_suggestion` o `make_accusation`, deben usar los **nuevos nombres corporativos** de habitación. El prompt de contexto que Clue Arena envía a MattinAI en cada turno (FLW-003, paso 1) debe incluir la lista de nombres válidos de habitación extraída de `HABITACIONES`:

```typescript
// En el coordinador de turnos (src/lib/game/coordinator.ts o auto-run.ts)
import { SOSPECHOSOS, ARMAS, HABITACIONES } from '@/types/domain';

const systemContext = `
Eres un agente jugando al Cluedo corporativo "El Algoritmo Asesinado".
Sospechosos válidos: ${SOSPECHOSOS.join(', ')}.
Armas válidas: ${ARMAS.join(', ')}.
Habitaciones válidas: ${HABITACIONES.join(', ')}.
`;
```

Esto garantiza que los agentes siempre reciben la lista canónica actualizada y no intentan usar nombres del Cluedo clásico.

---

## 8. Verificación de consistencia

Una vez aplicados los cambios, ejecutar:

```bash
# 1. Sin errores de tipos (HABITACIONES actualizado propaga correctamente)
npm run type-check

# 2. Sin errores de lint
npm run lint

# 3. Tests en verde (literales actualizados en game-engine.test.ts)
npm run test

# 4. Build limpio
npm run build

# 5a. Sin literales de habitaciones clásicas hardcoded
grep -r "Cocina\|Salón de baile\|Conservatorio\|Sala de billar\|Biblioteca\|Vestíbulo" src/ --include="*.ts" --include="*.tsx"
# → Sin resultados

# 5b. Sin literales de sospechosos clásicos hardcoded
grep -r "Coronel Mostaza\|Señora Pavo Real\|Reverendo Verde\|Señora Escarlata\|Profesor Ciruela\|Señorita Amapola" src/ --include="*.ts" --include="*.tsx"
# → Sin resultados

# 5c. Sin literales de armas clásicas hardcoded
grep -r "Candelabro\|Cuchillo\|Tubo de plomo\|Revólver\|Cuerda\|Llave inglesa" src/ --include="*.ts" --include="*.tsx"
# → Sin resultados
```

---

## 9. Reglas de consistencia (contractuales)

> Estas reglas deben mantenerse en todas las iteraciones futuras del proyecto:

| Regla | Descripción |
|---|---|
| **R-01** | `SOSPECHOSOS`, `ARMAS` y `HABITACIONES` en `src/types/domain.ts` son la **única fuente de verdad** de los nombres canónicos. |
| **R-02** | Los metadatos de UI (`PERSONAJE_META`, `ARMA_META`, `ESCENARIO_META`) solo se importan en componentes de presentación. |
| **R-03** | `src/lib/game/engine.ts` no importa metadatos de UI. |
| **R-04** | Las herramientas MCP (`src/lib/mcp/tools/`) usan `z.enum(HABITACIONES)` (y análogos) para validación, nunca enums hardcoded. |
| **R-05** | Cada asset en `public/game/escenarios/` tiene una entrada correspondiente en `ESCENARIO_META`. Sin assets huérfanos, sin entradas sin asset. |
| **R-06** | El prompt de contexto del coordinador de turnos incluye siempre los arrays `SOSPECHOSOS`, `ARMAS` y `HABITACIONES` dinámicamente (no hardcoded en el prompt). |

---

## 10. Tests adicionales propuestos

| Tipo | Archivo | Qué se verifica |
|---|---|---|
| Unitario | `src/tests/game-constants.test.ts` | `SOSPECHOSOS.length === 6`, `ARMAS.length === 6`, `HABITACIONES.length === 9`. |
| Unitario | `src/tests/game-constants.test.ts` | Todos los keys de `PERSONAJE_META` ∈ `SOSPECHOSOS`. |
| Unitario | `src/tests/game-constants.test.ts` | Todos los keys de `ARMA_META` ∈ `ARMAS`. |
| Unitario | `src/tests/game-constants.test.ts` | Todos los keys de `ESCENARIO_META` ∈ `HABITACIONES`. |
| Unitario | `src/tests/game-constants.test.ts` | Todas las rutas `imagen` de `ESCENARIO_META` corresponden a archivos existentes en `public/`. |

---

## 11. Criterios de aceptación

| # | Criterio |
|---|---|
| CA-01 | `HABITACIONES` en `src/types/domain.ts` contiene exactamente los 9 nombres corporativos del §3.3. |
| CA-02 | `SOSPECHOSOS` en `src/types/domain.ts` contiene exactamente los 6 nombres corporativos del §3.1. `ARMAS` contiene exactamente los 6 nombres corporativos del §3.2. |
| CA-03 | `PERSONAJE_META`, `ARMA_META` y `ESCENARIO_META` están definidos en `src/types/domain.ts` con todos los campos del §5.2. |
| CA-04 | Las herramientas MCP `make-suggestion` y `make-accusation` validan `room` usando `z.enum(HABITACIONES)` derivado de `domain.ts`. |
| CA-05 | `src/lib/game/engine.ts` no importa `PERSONAJE_META`, `ARMA_META` ni `ESCENARIO_META`. |
| CA-06 | `JuegoEscenarios` muestra los nombres corporativos y las imágenes de `public/game/escenarios/` con `next/image`. |
| CA-07 | `JuegoPersonajes` muestra el `departamento` de cada personaje y su nombre corporativo canónico. |
| CA-08 | `JuegoArmas` muestra los 6 nombres corporativos de arma con su emoji correspondiente. |
| CA-09 | `npm run type-check`, `npm run lint` y `npm run test` pasan sin errores. |
| CA-10 | El comando de verificación del §8 no devuelve ningún literal de habitación clásica en `src/`. |
| CA-11 | El coordinador de turnos incluye `HABITACIONES` dinámicamente en el contexto de invocación de MattinAI. |

---

## 12. Decisiones y preguntas abiertas

| ID | Tipo | Descripción |
|---|---|---|
| DECISION-F010-01 | Decisión | Los tres conjuntos de elementos usan nombres corporativos canónicos del evento en todos los niveles (motor, MCP, datos, UI). Sospechosos: `Directora Scarlett`, `Coronel Mustard`, `Sra. White`, `Sr. Green`, `Dra. Peacock`, `Profesor Plum`. Armas: `Cable de red`, `Teclado mecánico`, `Cafetera rota`, `Certificado SSL caducado`, `Grapadora industrial`, `Termo de acero`. Habitaciones: las 9 corporativas alineadas con los assets. No se usa ningún nombre del Cluedo clásico en ninguna capa de la implementación. |
| DECISION-F010-02 | Decisión | Los metadatos de UI (departamentos, alias, emojis, colores) se centralizan en `src/types/domain.ts` como constantes de solo lectura, no en base de datos. |
| OPENQ-F010-01 | Duda | ¿Debe el `get_game_state` MCP devolver también el `departamento` de cada sospechoso para ayudar al agente a construir un prompt más contextualizado? Impacto: si sí, requiere que la herramienta importe metadatos de UI (rompe R-02/R-03). Alternativa: el coordinador de turnos incluye los metadatos en el prompt de sistema. **Por ahora**: no incluir `departamento` en `get_game_state`; el prompt del coordinador es el canal correcto. |
| OPENQ-F010-02 | Duda | ¿Los 9 nombres de habitación en el asset `juego-escenarios.png` (imagen de la spec) coinciden exactamente con los nombres definidos en este RFC? La imagen no fue generada con los nombres del §3.3; puede haber discrepancias de capitalización o acentos. **Acción**: verificar visualmente la imagen y ajustar capitalización si es necesario antes de CA-10. |

---

## 13. Lista de cambios en el repositorio

| Fichero | Acción | Descripción |
|---|---|---|
| `src/types/domain.ts` | Editar | Actualizar `SOSPECHOSOS` (nombres corporativos) + `ARMAS` (nombres corporativos) + `HABITACIONES` (nombres corporativos) + añadir `PERSONAJE_META`, `ARMA_META`, `ESCENARIO_META`. |
| `src/lib/mcp/tools/make-suggestion.ts` | Editar | Usar `z.enum(HABITACIONES)` importado. |
| `src/lib/mcp/tools/make-accusation.ts` | Editar | Usar `z.enum(HABITACIONES)` importado. |
| `src/lib/mcp/tools/get-game-state.ts` | Revisar | Verificar que `room` en respuesta proviene de constante, no de literal. |
| `src/tests/game-engine.test.ts` | Editar | Reemplazar literales de habitaciones clásicas. |
| `src/tests/game-constants.test.ts` | Crear | Tests de consistencia de constantes + metadatos. |
| `src/components/game/juego/JuegoEscenarios.tsx` | Editar | Usar `ESCENARIO_META`; mostrar imagen `next/image` por habitación. |
| `src/components/game/juego/JuegoPersonajes.tsx` | Editar | Usar `PERSONAJE_META`; mostrar nombre corporativo y `departamento`. |
| `src/components/game/juego/JuegoArmas.tsx` | Editar | Usar `ARMA_META`; mostrar `alias` corporativo. |
| `src/lib/game/coordinator.ts` / `auto-run.ts` | Editar | Incluir `HABITACIONES` dinámicamente en el prompt de contexto de MattinAI. |
| `docs/rfc/F003-game-description.md` | Editar | Actualizar §3.4 (armas: nombres corporativos), §3.5 (personajes: nombres corporativos + departamento), §3.6 (escenarios: nombres corporativos). Actualizar §6.5, §6.6 y §6.7 con los nuevos valores de las constantes. |
