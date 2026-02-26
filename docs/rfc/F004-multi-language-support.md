# RFC F004 — Mecanismo de soporte multi-idioma (i18n)

| Campo | Valor |
|---|---|
| **ID** | F004 |
| **Título** | Mecanismo de soporte multi-idioma (i18n) con `next-intl` |
| **Estado** | Implemented |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-26 |
| **Refs. spec** | [70-frontend](../../clue-arena-spec/docs/spec/70-frontend.md) · [30-ui-spec](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [11-requisitos-tecnicos-nfr](../../clue-arena-spec/docs/spec/11-requisitos-tecnicos-nfr.md) |
| **Deps.** | RFC F001 · RFC F002 · RFC F003 |

---

## 1. Resumen

Este RFC define la arquitectura y el plan de implementación del soporte multi-idioma en Clue Arena. 

El **MVP del evento (mayo 2026) opera en español y euskera**, con textos actualmente hardcoded en español según la especificación técnica. Este RFC diseña el mecanismo para migrar esos textos a un sistema i18n estructurado — usando **`next-intl`** — añadiendo soporte real de euskera, y dejando el camino pavimentado para incorporar inglés en una fase posterior con coste mínimo.

El resultado final es:

- Todos los textos de la UI centralizados en ficheros de mensajes JSON por idioma bajo `src/messages/`.
- El locale activo determinado mediante **cookie** (`NEXT_LOCALE`), sin prefijo en la URL; las rutas son `/dashboard`, `/login`, etc. independientemente del idioma seleccionado.
- Acceso a traducciones tanto en Server Components como en Client Components mediante las APIs de `next-intl`.
- Un helper `formatters.ts` que encapsula `Intl.NumberFormat` / `Intl.DateTimeFormat` con el locale activo, reemplazando los `toLocaleString('es-ES')` hardcoded actuales.

---

## 2. Motivación

La especificación técnica actual ([70-frontend §7](../../clue-arena-spec/docs/spec/70-frontend.md)) establece:

> *"i18n: idioma único español en MVP. Sin librería i18n; textos hardcoded en español."*

Esto es correcto como punto de partida para un MVP de evento puntual. Sin embargo, la acumulación de textos hardcoded dispersos por componentes crea tres problemas que se agravan con el tiempo:

| Problema | Impacto concreto en Clue Arena |
|---|---|
| **Deuda técnica creciente** | Cada nuevo componente añade más strings disperos. Extraerlos después es más caro que hacerlo bien desde el inicio. |
| **Inconsistencia de tono y terminología** | Sin un fichero central, los mismos términos del dominio ("partida", "sospechoso", "acusación") pueden aparecer con grafías distintas en diferentes pantallas. |
| **Bloqueo para audiencias mixtas** | El evento incluye empleados euskaldunes. Sin i18n, añadir euskera requirería buscar y reemplazar strings en decenas de ficheros. |

La ventana de MVP (antes del evento) es el momento ideal para introducir la infraestructura, incluso si solo se usa un idioma. El coste incremental respecto a seguir hardcodeando es bajo; el beneficio a largo plazo es alto.

---

## 3. Decisiones de diseño

### 3.1 Elección de librería: `next-intl`

**`next-intl`** es la librería de internacionalización de referencia para Next.js App Router. A diferencia de `next-i18next` (diseñada para Pages Router) o soluciones genéricas como `react-i18next` (que no integran con Server Components), `next-intl` está construida específicamente para el modelo de React Server Components de Next.js 15.

Criterios de selección:

| Criterio | `next-intl` | `next-i18next` | `react-i18next` |
|---|---|---|---|
| Soporte nativo RSC / App Router | ✅ | ❌ (Pages Router) | Parcial |
| Server Components sin `"use client"` | ✅ | ❌ | ❌ |
| Tipado TypeScript de mensajes | ✅ (`Messages` inferido de JSON) | Parcial | Parcial |
| API unificada server + client | ✅ (`useTranslations` / `getTranslations`) | ❌ | ❌ |
| Formato de mensajes (ICU) | ✅ | ✅ | ✅ |
| Mantenimiento activo (feb 2026) | ✅ v3.x | Incierto | ✅ |
| `next/navigation` compatible | ✅ (re-exports tipados) | ❌ | ❌ |

**Decisión**: usar `next-intl` v3.x.

> **DECISION**: adoptar `next-intl` como única librería i18n. Registrar ADR cuando se apruebe este RFC.

### 3.2 Estrategia de routing de locales: cookie (sin prefijo de URL)

`next-intl` soporta tres estrategias para comunicar el locale activo al servidor:

| Estrategia | URLs | Caché CDN | Cambio de idioma |
|---|---|---|---|
| **Prefijo de URL** (`/es/...`) | Cambian por idioma | ✅ por locale | Navegación a nueva ruta |
| **Prefijo `as-needed`** (sin prefijo en defecto) | Híbrido | Parcial | Navegación o cookie |
| **Cookie** (sin prefijo) | Iguales en todos los idiomas | ❌ (varía por cookie) | Set cookie + `router.refresh()` |

Se elige **cookie** porque:

- Las URLs son **idénticas** en español y euskera (`/dashboard`, `/login`, etc.), lo que simplifica los tests E2E y los enlaces internos.
- El selector de idioma en la UI es una acción in-place (sin cambio de URL), más natural en una SPA de evento.
- El MVP no usa CDN; la pérdida de caché por locale es irrelevante en este contexto.
- No requiere segmento dinámico `[locale]` en el árbol de App Router: la estructura de `src/app/` no cambia.

El locale se almacena en la cookie `NEXT_LOCALE` (path `/`, `SameSite=Lax`). `getRequestConfig` la lee en cada petición. El locale por defecto si la cookie está ausente o contiene un valor desconocido es **`es`**.

> **DECISION**: usar cookie `NEXT_LOCALE` sin prefijo de URL. Registrar ADR cuando se apruebe este RFC.

### 3.3 Idiomas soportados

| Fase | Locales | Fecha objetivo |
|---|---|---|
| MVP (evento mayo 2026) | `es` (español), `eu` (euskera) | Mayo 2026 |
| Post-evento | `en` (inglés) | TBD |

Ambos ficheros `messages/es.json` y `messages/eu.json` deben estar completos para el MVP. El fichero `messages/en.json` se añadirá en la fase post-evento.

### 3.4 Formato de mensajes

Se usa el formato **ICU Message Format** que proporciona `next-intl`:

- Interpolación: `"Bienvenido, {nombre}"` → `t('bienvenido', { nombre: 'Alicia' })`
- Plurales: `"Tienes {count, plural, one {# partida} other {# partidas}}"`
- Selección: `"Rol: {rol, select, admin {Administrador} equipo {Equipo} other {Espectador}}"`

Los ficheros de mensajes son **JSON plano tipado**, organizados por namespaces que reflejan la estructura de pantallas/dominio.

---

## 4. Estructura de ficheros

```
src/
├── messages/
│   ├── es.json           # Mensajes en español (fuente de verdad, MVP)
│   ├── eu.json           # Mensajes en euskera (MVP)
│   └── en.json           # Mensajes en inglés (post-MVP, vacío hasta entonces)
├── i18n/
│   └── request.ts        # getRequestConfig: lee cookie NEXT_LOCALE
├── components/
│   └── layout/
│       └── LocaleSwitcher.tsx  # ← NUEVO: selector de idioma (cookie + refresh)
├── app/                  # Sin segmento [locale]; estructura inalterada
│   ├── layout.tsx        # Root layout (NextIntlClientProvider)
│   ├── page.tsx
│   ├── login/
│   ├── dashboard/
│   ├── equipo/
│   ├── ranking/
│   ├── partidas/
│   └── admin/
└── middleware.ts         # Solo auth + RBAC; sin middleware i18n
```

> **Nota**: la estrategia cookie elimina el segmento `[locale]` del árbol de rutas. Las rutas de API (`app/api/`) no cambian. No se genera `routing.ts` ni se exporta `navigation.ts` para locale-routing — se usa directamente `next/navigation`.

### 4.1 Organización del fichero `messages/es.json`

```json
{
  "common": {
    "cargando": "Cargando...",
    "error": "Se produjo un error",
    "sinDatos": "No hay datos disponibles",
    "volver": "Volver",
    "guardar": "Guardar",
    "cancelar": "Cancelar",
    "confirmar": "Confirmar",
    "cerrarSesion": "Cerrar sesión"
  },
  "nav": {
    "dashboard": "Dashboard",
    "juego": "El Juego",
    "ranking": "Ranking",
    "partidas": "Partidas",
    "admin": "Admin",
    "miEquipo": "Mi Equipo"
  },
  "auth": {
    "iniciarSesion": "Iniciar sesión",
    "iniciandoSesion": "Iniciando sesión...",
    "errorLogin": "Error al iniciar sesión. Inténtalo de nuevo.",
    "accesoRestringido": "Acceso restringido",
    "sinPermiso": "No tienes permiso para acceder a esta sección."
  },
  "dashboard": {
    "bienvenido": "Bienvenido, {nombre}",
    "rankingTitulo": "Clasificación del Evento",
    "estadisticasTitulo": "Estadísticas de tu Equipo",
    "actividadTitulo": "Actividad Reciente",
    "tuEquipo": "(Tú)",
    "posicion": "Posición {pos}",
    "puntos": "{puntos} pts",
    "sinActividad": "No hay actividad reciente"
  },
  "equipo": {
    "registroTitulo": "Registrar Equipo",
    "nombre": "Nombre del equipo",
    "integrantes": "Integrantes",
    "agentUrl": "URL del agente IA",
    "registrar": "Registrar equipo",
    "registrando": "Registrando...",
    "registroExito": "Equipo registrado correctamente",
    "registroError": "Error al registrar el equipo"
  },
  "ranking": {
    "titulo": "Ranking del Evento",
    "posicion": "Pos.",
    "equipo": "Equipo",
    "puntos": "Puntos",
    "partidas": "Partidas",
    "victorias": "Victorias",
    "sinEquipos": "Todavía no hay equipos registrados"
  },
  "partidas": {
    "titulo": "Partida #{id}",
    "estado": {
      "pendiente": "Pendiente",
      "enCurso": "En curso",
      "finalizada": "Finalizada",
      "cancelada": "Cancelada"
    },
    "turno": "Turno {n}",
    "sinPartidas": "No hay partidas disponibles",
    "acusacion": "Acusación",
    "sugerencia": "Sugerencia",
    "resultado": {
      "victoria": "Victoria",
      "eliminado": "Eliminado",
      "empate": "Empate"
    }
  },
  "admin": {
    "titulo": "Panel de Administración",
    "equipos": "Equipos",
    "gestionPartidas": "Gestión de Partidas",
    "crearPartida": "Crear Partida",
    "iniciarPartida": "Iniciar Partida",
    "finalizarPartida": "Finalizar Partida",
    "confirmarAccion": "¿Confirmar esta acción?",
    "equiposSinRegistrar": "No hay equipos registrados todavía"
  },
  "juego": {
    "titulo": "El Juego",
    "subtitulo": "El Algoritmo Asesinado",
    "mecanica": "Mecánica de Juego",
    "personajes": "Sospechosos",
    "armas": "Armas",
    "escenarios": "Escenarios",
    "objetivos": "Objetivos del Evento"
  },
  "errores": {
    "404titulo": "Página no encontrada",
    "404descripcion": "La página que buscas no existe.",
    "500titulo": "Error interno",
    "500descripcion": "Algo salió mal. Por favor, inténtalo de nuevo.",
    "noAutorizado": "No autorizado",
    "forbidden": "Acceso denegado"
  }
}
```

---

## 5. Implementación

### 5.1 Instalación

```bash
npm install next-intl
```

No hay dependencias de tipos adicionales; `next-intl` incluye sus propias definiciones TypeScript y genera el tipo `Messages` a partir del JSON de mensajes.

### 5.2 Sin `routing.ts`

Con la estrategia cookie no se usa `defineRouting`; no existe `src/i18n/routing.ts`. Este fichero solo sería necesario si se eligiera la estrategia de prefijo de URL. La configuración de locales válidos se declara directamente en `request.ts` (§5.3).

### 5.3 `src/i18n/request.ts`

Lee la cookie `NEXT_LOCALE` de la petición entrante para determinar el locale activo:

```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const SUPPORTED_LOCALES = ['es', 'eu', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
// Locales disponibles en producción MVP; 'en' aún no tiene traducciones completas
export const ACTIVE_LOCALES: Locale[] = ['es', 'eu'];
export const DEFAULT_LOCALE: Locale = 'es';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;

  // Fallback al locale por defecto si la cookie no existe o tiene un valor desconocido
  const locale: Locale = ACTIVE_LOCALES.includes(cookieValue as Locale)
    ? (cookieValue as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

### 5.4 Sin `navigation.ts` especial

Con la estrategia cookie no hay locale routing; las URLs son iguales en todos los idiomas. Se usa directamente `next/navigation` (`Link`, `useRouter`, `redirect`, `usePathname`) sin wrapper de `next-intl`.

El único punto donde el locale influye en la navegación es el **selector de idioma** (`LocaleSwitcher`, §5.7), que cambia la cookie y llama `router.refresh()`.

### 5.5 Actualización de `src/middleware.ts`

Con la estrategia cookie **no es necesario importar nada de `next-intl`** en el middleware. La detección de locale la hace `getRequestConfig` en `request.ts`, no el middleware. El middleware mantiene únicamente su responsabilidad de autenticación y RBAC:

```typescript
import { auth } from '@/lib/auth/edge-config';
import { NextRequest, NextResponse } from 'next/server';

// Rutas que no pasan por autenticación
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/mcp'];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Excluir rutas de API del middleware de páginas
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Autenticación y RBAC
  const session = await auth();
  const isPublic = PUBLIC_PATHS.some(p => pathname.includes(p));

  if (!session?.user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // RBAC por rol (igual que la lógica actual)
  if (session?.user) {
    const { rol } = session.user as { rol: string };
    if (pathname.includes('/admin') && rol !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Excluir estáticos, _next y explícitamente /api/mcp
    '/((?!_next|_vercel|.*\\..*).*)',
    '/api/((?!mcp|auth).*)',
  ],
};
```

### 5.6 Root layout: `src/app/layout.tsx`

Sin segmento `[locale]`, el root layout es el fichero estándar de Next.js. `getLocale()` devuelve el locale determinado por `getRequestConfig` (cookie):

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

type Props = { children: React.ReactNode };

export default async function RootLayout({ children }: Props) {
  // Locale resuelto por getRequestConfig (cookie NEXT_LOCALE)
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 5.7 Selector de idioma: `src/components/layout/LocaleSwitcher.tsx`

Componente cliente que guarda el locale elegido en la cookie `NEXT_LOCALE` y fuerza un re-render del Server Component tree sin cambiar la URL:

```typescript
'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ACTIVE_LOCALES, type Locale } from '@/i18n/request';

const LOCALE_LABELS: Record<Locale, string> = {
  es: 'ES',
  eu: 'EU',
  en: 'EN',
};

export function LocaleSwitcher() {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(locale: Locale) {
    // Guardar en cookie (SameSite=Lax, path=/)
    document.cookie = `NEXT_LOCALE=${locale}; path=/; SameSite=Lax`;
    startTransition(() => {
      router.refresh(); // Re-fetch Server Components con el nuevo locale
    });
  }

  return (
    <div className="flex gap-1">
      {ACTIVE_LOCALES.map(locale => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          disabled={isPending || locale === currentLocale}
          className={`px-2 py-1 text-xs rounded ${
            locale === currentLocale
              ? 'bg-cyan-500 text-slate-900 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
```

El `LocaleSwitcher` se integra en el `AppShell` / sidebar junto al botón de cerrar sesión.

### 5.7 Uso en Server Components

```typescript
// src/app/[locale]/dashboard/page.tsx
import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  return (
    <section>
      <h1>{t('rankingTitulo')}</h1>
      {/* ... */}
    </section>
  );
}
```

### 5.8 Uso en Client Components

```typescript
'use client';

// src/components/dashboard/RankingPodium.tsx
import { useTranslations } from 'next-intl';

export function RankingPodium({ entries }: Props) {
  const t = useTranslations('dashboard');

  return (
    <div>
      <h2>{t('rankingTitulo')}</h2>
      {entries.map(e => (
        <span key={e.id}>{t('tuEquipo')}</span>
      ))}
    </div>
  );
}
```

### 5.9 Tipado fuerte de mensajes

Para obtener autocompletado y detección de typos en claves de traducción, añadir en `src/types/global.d.ts`:

```typescript
// Tipado automático de los mensajes de next-intl
import esMessages from '../messages/es.json';

type Messages = typeof esMessages;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntlMessages extends Messages {}
}
```

Con esto, `t('claveInexistente')` producirá un error de TypeScript en tiempo de compilación.

---

## 6. Formateo de números y fechas

Los helpers actuales en `src/lib/utils/formatting.ts` tienen el locale hardcoded a `'es-ES'`:

```typescript
// ACTUAL — hardcoded
return puntos.toLocaleString('es-ES');
return d.toLocaleDateString('es-ES', { ... });
```

Se reemplazarán por un helper que obtiene el locale activo:

```typescript
// src/lib/utils/formatting.ts — NUEVO
import { getLocale } from 'next-intl/server'; // en Server Components
// En Client Components usar useLocale() de next-intl

// Mapa de locale de app → BCP 47 para Intl APIs
const INTL_LOCALE_MAP: Record<string, string> = {
  es: 'es-ES',
  eu: 'eu-ES', // Euskera (País Vasco)
  en: 'en-GB',
};

export async function formatPuntos(puntos: number): Promise<string> {
  const locale = await getLocale();
  return new Intl.NumberFormat(INTL_LOCALE_MAP[locale] ?? 'es-ES', {
    maximumFractionDigits: 0,
  }).format(puntos);
}

export async function formatFecha(fecha: Date | string): Promise<string> {
  const locale = await getLocale();
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat(INTL_LOCALE_MAP[locale] ?? 'es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}
```

Para Client Components existe `useFormatter()` de `next-intl` que envuelve `Intl` con el locale activo automáticamente:

```typescript
'use client';
import { useFormatter } from 'next-intl';

export function PodiumCard({ puntos }: { puntos: number }) {
  const format = useFormatter();
  return <span>{format.number(puntos)}</span>;
}
```

---

## 7. Estrategia de migración

La migración se realiza de forma incremental para no romper el MVP en ningún punto intermedio.

### Fase 0 — Infraestructura (no rompe nada)

1. Instalar `next-intl`.
2. Crear `src/i18n/request.ts` con lectura de cookie (no se necesita `routing.ts`).
3. Crear `src/messages/es.json` con todas las claves (si falta una clave, `next-intl` lanza warning pero no rompe).
4. Crear `src/messages/eu.json` vacío inicialmente (se completa en Fase 1).
5. Añadir tipado en `src/types/global.d.ts`.
6. Actualizar `src/app/layout.tsx` para incluir `NextIntlClientProvider` — **no es necesario crear un segmento `[locale]`**.
7. Añadir `next-intl` plugin en `next.config.ts`.
8. Crear `LocaleSwitcher.tsx` e integrarlo en el `AppShell`.

### Fase 1 — Migración de textos (namespace por namespace)

Prioridad de migración: componentes con más strings → menos strings.

| Orden | Namespace | Ficheros afectados |
|---|---|---|
| 1 | `common`, `nav` | `AppShell`, `Sidebar` |
| 2 | `auth` | `login/page.tsx`, `DevLoginButtons.tsx` |
| 3 | `dashboard` | `RankingPodium`, `PodiumCard`, `ActivityFeed`, `dashboard/page.tsx` |
| 4 | `equipo` | `equipo/page.tsx`, `equipo/registro/page.tsx` |
| 5 | `ranking` | `ranking/page.tsx` |
| 6 | `partidas` | `partidas/[id]/page.tsx`, `GameContext.tsx` |
| 7 | `admin` | `admin/page.tsx`, `admin/partidas/` |
| 8 | `juego` | `dashboard/juego/page.tsx` y subcomponentes |
| 9 | `errores` | `error.tsx`, `not-found.tsx` |

### Fase 2 — Migración de formatters

Reemplazar `toLocaleString('es-ES')` en `src/lib/utils/formatting.ts` y todos sus consumidores (`RankingPodium.tsx`, `PodiumCard.tsx`).

### Fase 2b — Completar traducciones euskera (MVP)

Traducir todas las claves de `messages/es.json` al euskera en `messages/eu.json`. Criterio de completitud: sin claves con fallback al español en producción.

### Fase 3 — Añadir inglés (post-MVP)

1. Crear `src/messages/en.json` con las mismas claves que `es.json`.
2. Añadir `'en'` al array `ACTIVE_LOCALES` en `src/i18n/request.ts`.
3. Añadir `'en'` al objeto `LOCALE_LABELS` en `LocaleSwitcher.tsx`.

---

## 8. Configuración de Next.js

`next-intl` requiere un plugin en `next.config.ts`:

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  // ...configuración existente
};

export default withNextIntl(nextConfig);
```

---

## 9. Testing

### 9.1 Tests unitarios (Vitest)

Los componentes que usan `useTranslations` o `getTranslations` requieren un wrapper de proveedor en los tests:

```typescript
// src/tests/setup-intl.ts
import { NextIntlClientProvider } from 'next-intl';
import esMessages from '../messages/es.json';

export function createIntlWrapper(locale = 'es') {
  return function IntlWrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={esMessages}>
        {children}
      </NextIntlClientProvider>
    );
  };
}
```

Uso en tests:

```typescript
import { render } from '@testing-library/react';
import { createIntlWrapper } from '../setup-intl';
import { PodiumCard } from '@/components/dashboard/PodiumCard';

test('PodiumCard muestra puntos formateados', () => {
  const { getByText } = render(
    <PodiumCard puntos={1500} nombre="Equipo Alfa" posicion={1} />,
    { wrapper: createIntlWrapper() }
  );
  expect(getByText('1.500')).toBeInTheDocument();
});
```

### 9.2 Tests E2E (Playwright)

Con la estrategia cookie **las URLs no cambian** respecto al estado actual (`/login`, `/dashboard`, etc.), por lo que los tests E2E existentes en `e2e/smoke.spec.ts` no requieren ajuste de rutas.

Sí se deben añadir tests para verificar el cambio de idioma:

```typescript
// e2e/smoke.spec.ts — test selector de idioma
test('cambio a euskera aplica traducciones', async ({ page }) => {
  await page.goto('/dashboard');
  // Cambiar a euskera via LocaleSwitcher
  await page.click('[data-testid="locale-switcher-eu"]');
  await page.waitForLoadState('networkidle');
  // Verificar que un texto en EU aparece (ejemplo)
  await expect(page.locator('h1')).not.toBeEmpty();
  // Restaurar
  await page.click('[data-testid="locale-switcher-es"]');
});
```

### 9.3 Validación TypeScript

El tipado fuerte de mensajes (§5.9) garantiza que cualquier clave inexistente se detecte en `npm run type-check`. Añadir al ciclo de CI:

```bash
npm run type-check  # detecta claves de traducción incorrectas
```

---

## 10. Restricciones y consideraciones

| Punto | Detalle |
|---|---|
| **Edge runtime** | `getLocale()` de `next-intl/server` **no** está disponible en Edge runtime. En `src/middleware.ts` usar solo `createMiddleware` de `next-intl`. No llamar a `getLocale()` desde el middleware. |
| **Route Handlers** | Las rutas `app/api/**` no se mueven bajo `[locale]`. No llamar a `getTranslations` ni `getLocale` en Route Handlers; son APIs JSON y no tienen contexto de idioma de usuario. |
| **`src/components/ui/`** | Componentes shadcn/ui no se tocan (no contienen strings de usuario, solo primitivas de UI). |
| **Motor de juego** | `src/lib/game/engine.ts` es lógica pura sin I/O; no expone strings de UI. Los mensajes de dominio del juego (nombres de personajes, armas, etc.) se definen como constantes en `src/lib/game/types.ts` y se traducen en la capa de presentación. |
| **MCP Server** | Las respuestas del MCP Server (`src/lib/mcp/`) son JSON estructurado para consumo por agentes IA; no requieren internacionalización. |
| **Caché por locale** | Con la estrategia cookie, Next.js no puede cachear distintas versiones de la misma URL por locale. Esto es aceptable en el MVP (evento interno sin CDN). Si en el futuro se necesita caché por idioma, migrar a `localePrefix: 'always'` requiere añadir `[locale]` al árbol de rutas. |

---

## 11. Criterios de aceptación

- [ ] `npm install next-intl` ejecutado sin conflictos de versiones.
- [ ] `src/app/` sin segmento `[locale]`; todas las rutas responden igual (`/dashboard`, `/login`, etc.).
- [ ] Con cookie `NEXT_LOCALE=eu`, la UI renderiza textos en euskera. Sin cookie (o valor desconocido), la UI renderiza en español.
- [ ] El `LocaleSwitcher` cambia el idioma in-place sin cambiar la URL.
- [ ] `npm run type-check` pasa sin errores; clave inexistente en `t()` produce error de TypeScript.
- [ ] `npm run build` pasa sin errores.
- [ ] Tests unitarios pasan con el wrapper `NextIntlClientProvider`.
- [ ] Tests E2E en `e2e/smoke.spec.ts` pasan sin modificar rutas (`/dashboard` sigue siendo `/dashboard`).
- [ ] No hay ningún `toLocaleString('es-ES')` hardcoded fuera de `src/lib/utils/formatting.ts`.
- [ ] `messages/eu.json` completo (sin claves vacías) antes del evento.
- [ ] Añadir inglés solo requiere: crear `messages/en.json` + añadir `'en'` a `ACTIVE_LOCALES` en `request.ts`.

---

## 12. Fuentes

| URL | Fecha | Qué se extrajo |
|---|---|---|
| https://next-intl-docs.vercel.app/docs/getting-started/app-router | 2026-02-26 | Guía oficial de instalación y configuración con App Router, API de `defineRouting`, `getRequestConfig`, `createNavigation` y `NextIntlClientProvider`. |
| https://next-intl-docs.vercel.app/docs/routing | 2026-02-26 | Estrategias de prefijo de locale (`always`, `as-needed`, `never`) y compatibilidad con middleware de Next.js. |
| https://next-intl-docs.vercel.app/docs/usage/typescript | 2026-02-26 | Tipado fuerte de mensajes con `IntlMessages` global y detección de claves inexistentes en tiempo de compilación. |
| https://next-intl-docs.vercel.app/docs/environments/server-client-components | 2026-02-26 | Diferencias entre `getTranslations` (Server Components, async) y `useTranslations` (Client Components, síncrono). |
