# RFC F013 — Página Pública de Instrucciones para Construir Agentes

| Campo | Valor |
|---|---|
| **ID** | F013 |
| **Título** | Página pública de instrucciones para construir agentes IA: contrato MCP, herramientas, esquemas y guía de inicio rápido |
| **Estado** | Draft |
| **Autor** | Equipo Clue Arena |
| **Fecha** | 2026-02-28 |
| **Refs. spec** | [00-context](../../clue-arena-spec/docs/spec/00-context.md) · [20-conceptualizacion](../../clue-arena-spec/docs/spec/20-conceptualizacion.md) · [30-ui-spec](../../clue-arena-spec/docs/spec/30-ui-spec.md) · [60-backend](../../clue-arena-spec/docs/spec/60-backend.md) · [80-seguridad](../../clue-arena-spec/docs/spec/80-seguridad.md) |
| **Deps.** | RFC F001 · RFC F003 · RFC F006 · RFC F007 · RFC F010 · RFC G001 · RFC G002 · RFC G003 |

---

## 1. Resumen

Este RFC define la página **`/instrucciones`**: una ruta **públicamente accesible** (sin autenticación) que proporciona a los equipos toda la información técnica necesaria para construir, desplegar y registrar un agente IA que juegue al Cluedo en la plataforma Clue Arena.

La página cubre:

1. **Visión general**: qué es un agente Clue Arena y cómo se integra con el motor.
2. **Contrato MCP**: endpoint, autenticación (Bearer token) y protocolo de comunicación.
3. **Herramientas disponibles**: descripción, parámetros y esquemas JSON de `get_game_state`, `get_agent_memory` y `save_agent_memory`.
4. **Estructura de la respuesta del agente**: esquemas para `play_turn` y `refute` con ejemplos.
5. **Elementos del juego**: tablas canónicas de sospechosos, armas y escenarios (nombres exactos que deben aparecer en la respuesta del agente).
6. **Sistema de puntuación**: tabla de eventos para que los equipos optimicen la estrategia de su agente.
7. **Inicio rápido**: plantillas de agente mínimo en Python (SDK MCP oficial) y TypeScript.
8. **Preguntas frecuentes y errores comunes**.

La página es un **Server Component puro** (sin fetch de API en runtime, sin estado de cliente). El contenido se renderiza desde constantes del dominio y MDX/JSX estático.

---

## 2. Motivación y contexto

### 2.1 Problema actual

No existe ningún punto de entrada documentado que guíe a los equipos en la construcción de su agente fuera de la propia interacción con los organizadores. Esto genera:

| Problema | Impacto |
|---|---|
| Los equipos no conocen el contrato MCP hasta que se les entrega manualmente | Retraso en el desarrollo de los agentes; dependencia de comunicación out-of-band |
| El esquema de `AgentResponse` no está publicado en ningún lugar accesible | Errores de formato, penalizaciones `EVT_INVALID_FORMAT` evitables |
| Los nombres canónicos de sospechosos, armas y escenarios no están disponibles hasta ver una partida | Sugerencias con nombres incorrectos que resultan en `EVT_INVALID_CARD` |
| El sistema de puntuación no es conocido antes del evento | Los agentes no optimizan para los incentivos reales (eficiencia, refutación, evitar pases) |
| No hay plantillas de arranque → barrera técnica para equipos sin experiencia en MCP | Participación reducida de equipos con agentes funcionales el día del evento |

### 2.2 Motivación de acceso público (sin login)

La página debe ser accesible **sin autenticación** porque:

- Los equipos necesitan preparar su agente antes de recibir sus credenciales corporativas de la organización.
- La documentación del contrato MCP es información técnica pública que no revela ningún estado de partida ni ventaja competitiva.
- Reduce la fricción de onboarding desde el primer día de comunicación del evento.

> **Decisión de diseño**: `/instrucciones` es la única ruta de la aplicación excluida del matcher de sesión del middleware. El token MCP de cada equipo (`TEAM_MCP_TOKEN`) se distribuye por canal fuera de la plataforma (correo / Slack) y no se muestra en esta página.

---

## 3. Diseño de la página

### 3.1 Ruta y layout

| Atributo | Valor |
|---|---|
| Ruta Next.js | `src/app/instrucciones/page.tsx` |
| Acceso | Público (sin `auth()`, excluida del middleware matcher) |
| Runtime | Node.js (Server Component) |
| Tipo de componente | Server Component puro — cero `"use client"` |
| Layout | Sin `AppShell` — layout propio de documentación (`InstructionsLayout`) |
| Idioma del contenido | Español (contenido narrativo) + inglés (identificadores técnicos, código) |

### 3.2 Tema visual

La página sigue el tema oscuro del dashboard (F002) pero con una paleta de documentación técnica más legible:

| Elemento | Clase Tailwind |
|---|---|
| Fondo de página | `bg-slate-950` |
| Fondo de secciones de contenido | `bg-slate-900` |
| Fondo de bloques de código | `bg-slate-800` |
| Borde de secciones | `border border-slate-700` |
| Acento principal / headings | `text-cyan-400` |
| Texto de aviso / advertencias | `text-amber-400` |
| Texto de éxito / correcto | `text-emerald-400` |
| Texto de error / incorrecto | `text-red-400` |
| Texto de cuerpo | `text-slate-200` |
| Fuente de código | `font-mono text-sm` |

### 3.3 Estructura de secciones

La página se compone de las siguientes secciones en orden lineal (scroll vertical), con una tabla de contenidos fija en sidebar derecho en pantallas ≥ 1280 px:

```
/instrucciones
│
├── §1  Hero / Introducción
│       Titular del evento, tagline, qué construir, fecha límite.
│
├── §2  Cómo funciona un agente Clue Arena
│       Diagrama de secuencia simplificado de un turno.
│       Diferencia entre play_turn y refute.
│
├── §3  Contrato MCP
│       Endpoint, autenticación, formato de mensajes JSON-RPC.
│
├── §4  Herramientas disponibles
│       get_game_state · get_agent_memory · save_agent_memory
│       (parámetros, respuesta, ejemplo JSON)
│
├── §5  Estructura de la respuesta del agente
│       Esquema AgentResponse para play_turn y refute.
│       Tabla de tipos de acción válidos.
│
├── §6  Elementos del juego
│       Tabla de sospechosos · armas · escenarios (nombres canónicos).
│
├── §7  Sistema de puntuación
│       Tabla de eventos puntuables y fórmula de eficiencia.
│
├── §8  Inicio rápido
│       Plantilla Python (SDK MCP oficial).
│       Plantilla TypeScript (SDK MCP oficial).
│
├── §9  Registro del agente
│       Cómo registrar el endpoint del agente en el panel de equipo.
│
└── §10 Preguntas frecuentes y errores comunes
        Tabla de errores frecuentes y cómo evitarlos.
```

---

## 4. Contenido técnico por sección

### 4.1 §2 — Cómo funciona un agente Clue Arena

El motor de juego invoca al agente del equipo en dos situaciones durante la partida:

| Situación | Modo | Qué debe devolver el agente |
|---|---|---|
| Es el turno del equipo | `play_turn` | Una sugerencia (`suggestion`), una acusación (`accusation`) o un pase (`pass`) |
| El equipo puede refutar la sugerencia de otro | `refute` | Qué carta mostrar (`show_card`) o que no puede refutar (`cannot_refute`) |

**Diagrama de secuencia simplificado (turno `play_turn`)**:

```
Motor de juego
     │
     │  POST /api/mcp   (MCP tool: get_game_state)
     ├──────────────────────────────────────────────► Agente
     │◄──────────────────────────────────────────────
     │                             GameStateView filtrada
     │
     │  POST /api/mcp   (MCP tool: get_agent_memory)
     ├──────────────────────────────────────────────► Agente
     │◄──────────────────────────────────────────────
     │                             Memoria persistida del agente
     │
     │  (el agente razona y decide)
     │
     │  AgentResponse { action: "suggestion", ... }
     │◄──────────────────────────────────────────────
     │
     │  (el motor valida y aplica la acción)
     │  POST /api/mcp   (MCP tool: save_agent_memory)  ← si el agente lo solicita
     ├──────────────────────────────────────────────► Agente / Motor
     │
     │  Estado de partida actualizado
```

> El agente **no llama directamente** a `make_suggestion` ni `make_accusation`. La acción se expresa en la `AgentResponse` devuelta al motor, que la aplica y la persiste.

### 4.2 §3 — Contrato MCP

#### Endpoint

```
POST https://<dominio-del-evento>/api/mcp
Content-Type: application/json
Authorization: Bearer <TEAM_MCP_TOKEN>
```

El servidor MCP sigue el protocolo [Model Context Protocol](https://modelcontextprotocol.io) en su variante **HTTP+JSON-RPC**. Se recomienda usar el SDK oficial en lugar de implementar el protocolo manualmente.

#### Autenticación

- Cada equipo recibe un token Bearer único (`TEAM_MCP_TOKEN`) comunicado por la organización.
- El token es fijo para toda la competición (no expira entre partidas).
- **No incluir el token en código público** (repositorio privado o variable de entorno).

#### SDK oficial recomendado

| Lenguaje | Paquete | Versión mínima |
|---|---|---|
| Python | `mcp` (PyPI) | 1.x |
| TypeScript / JavaScript | `@modelcontextprotocol/sdk` (npm) | 1.x |

### 4.3 §4 — Herramientas disponibles

Las tres herramientas disponibles son de **solo lectura** (consulta/memoria). Las acciones de juego se expresan exclusivamente en la respuesta devuelta al motor.

---

#### `get_game_state`

Retorna el estado de la partida filtrado para el equipo que realiza la llamada. El motor garantiza que el agente solo ve la información que el reglamento permite: sus propias cartas, historial de sugerencias público y el número de cartas de los oponentes (no su contenido).

**Parámetros de entrada**:

```json
{
  "game_id": "string",   // ID de la partida en curso
  "team_id": "string"    // ID del equipo (coincide con el issuer del token)
}
```

**Respuesta** (`GameStateView`):

```json
{
  "gameId": "string",
  "estado": "en_curso | finalizada | pendiente",
  "turnoActual": 3,
  "esElTurnoDeEquipo": true,
  "equipos": [
    {
      "equipoId": "string",
      "orden": 0,
      "esPropio": true,
      "eliminado": false,
      "numCartas": 4,
      "cartas": [
        "Directora Scarlett",
        "El Despacho del CEO",
        "Cable HDMI Robado",
        "Dra. Peacock"
      ]
    },
    {
      "equipoId": "string",
      "orden": 1,
      "esPropio": false,
      "eliminado": false,
      "numCartas": 3,
      "cartas": []
    }
  ],
  "historial": [
    {
      "turno": 1,
      "equipoId": "string",
      "tipo": "suggestion",
      "sospechoso": "Coronel Mustard",
      "arma": "Laptop Cifrada",
      "escenario": "El Laboratorio",
      "refutadoPor": "string | null",
      "cartaMostrada": "Coronel Mustard | null",
      "nadiePudoRefutar": false
    }
  ]
}
```

> **Nota sobre `cartaMostrada`**: solo se rellena en entradas del historial donde `esPropio === true` y el equipo fue el **sugeridor**. Si el equipo fue el refutador, sabe qué carta mostró (la eligió él). Para el resto de equipos, la carta concreta mostrada nunca es visible (solo que hubo refutación).

---

#### `get_agent_memory`

Recupera la memoria persistida del agente para esta partida. La memoria es un objeto JSON libre que el agente guarda entre invocaciones para mantener su estado de deducción (cartas descartadas, hipótesis, anotaciones de la libreta).

**Parámetros de entrada**:

```json
{
  "game_id": "string",
  "team_id": "string"
}
```

**Respuesta**:

```json
{
  "memory": { }   // objeto JSON arbitrario; vacío {} en el primer turno
}
```

---

#### `save_agent_memory`

Persiste la memoria del agente para la partida actual. Debe llamarse al final del razonamiento del agente para guardar las deducciones del turno.

**Parámetros de entrada**:

```json
{
  "game_id": "string",
  "team_id": "string",
  "memory": {
    "cartasDescartadas": ["Directora Scarlett", "El Laboratorio"],
    "hipotesisSobre": {
      "sospechoso": "Coronel Mustard",
      "confianza": 0.8
    }
  }
}
```

**Respuesta**:

```json
{ "ok": true }
```

> La memoria puede contener cualquier estructura JSON serializable. El motor no la interpreta; es exclusiva del agente. El tamaño máximo es **64 KB por equipo por partida**.

### 4.4 §5 — Estructura de la respuesta del agente

El motor espera que el agente devuelva un objeto `AgentResponse` con la siguiente estructura:

```typescript
type AgentResponse =
  | { action: "suggestion"; sospechoso: string; arma: string; escenario: string }
  | { action: "accusation"; sospechoso: string; arma: string; escenario: string }
  | { action: "pass" }
  | { action: "show_card"; carta: string }
  | { action: "cannot_refute" };
```

#### Tabla de acciones válidas por modo

| Modo de invocación | Acciones válidas | Acciones inválidas (→ `EVT_INVALID_FORMAT`) |
|---|---|---|
| `play_turn` | `suggestion`, `accusation`, `pass` | `show_card`, `cannot_refute` |
| `refute` | `show_card`, `cannot_refute` | `suggestion`, `accusation`, `pass` |

#### Ejemplos de respuesta

**`play_turn` — Sugerencia**:
```json
{
  "action": "suggestion",
  "sospechoso": "Coronel Mustard",
  "arma": "Laptop Cifrada",
  "escenario": "El Laboratorio"
}
```

**`play_turn` — Acusación** (cuando el equipo está seguro de la solución):
```json
{
  "action": "accusation",
  "sospechoso": "Dra. Peacock",
  "arma": "Cable HDMI Robado",
  "escenario": "La Sala de Servidores"
}
```

**`play_turn` — Pase voluntario** (penaliza `EVT_PASS`: −5 pts; usar solo si no hay alternativa):
```json
{ "action": "pass" }
```

**`refute` — Mostrar carta**:
```json
{
  "action": "show_card",
  "carta": "Coronel Mustard"
}
```
> La carta mostrada debe ser **una de las cartas propias** que coincida con alguna de las tres cartas de la sugerencia. Si se envía una carta que no pertenece al equipo, el motor aplica `EVT_INVALID_FORMAT`.

**`refute` — No puede refutar**:
```json
{ "action": "cannot_refute" }
```

### 4.5 §6 — Elementos del juego

Los valores de `sospechoso`, `arma` y `escenario` en las respuestas del agente **deben coincidir exactamente** (mayúsculas, tildes, espacios) con los nombres canónicos del evento:

#### Sospechosos (6)

| ID | Nombre canónico | Departamento | Color |
|---|---|---|---|
| S-01 | `Directora Scarlett` | Marketing | Rojo |
| S-02 | `Coronel Mustard` | Seguridad | Amarillo |
| S-03 | `Sra. White` | Administración | Blanco |
| S-04 | `Sr. Green` | Finanzas | Verde |
| S-05 | `Dra. Peacock` | Legal | Azul |
| S-06 | `Profesor Plum` | Innovación | Púrpura |

#### Armas (6)

| ID | Nombre canónico |
|---|---|
| A-01 | `Laptop Cifrada` |
| A-02 | `Cable HDMI Robado` |
| A-03 | `Memoria USB Infectada` |
| A-04 | `Manual de Políticas` |
| A-05 | `Badge de Acceso Clonado` |
| A-06 | `Informe de Auditoría` |

#### Escenarios (9)

| ID | Nombre canónico |
|---|---|
| E-01 | `El Despacho del CEO` |
| E-02 | `El Laboratorio` |
| E-03 | `El Open Space` |
| E-04 | `La Cafetería` |
| E-05 | `La Sala de Juntas` |
| E-06 | `La Sala de Servidores` |
| E-07 | `La Zona de Descanso` |
| E-08 | `Recursos Humanos` |
| E-09 | `El Almacén de IT` |

> **Importante**: un nombre incorrecto (incluyendo diferencias de capitalización o tildes) genera `EVT_INVALID_CARD` (−30 puntos) y el turno no se aplica como sugerencia válida.

### 4.6 §7 — Sistema de puntuación

Los agentes deben optimizar para los siguientes eventos. Ver RFC G001 para la definición completa.

| Evento | Puntos | Cuándo ocurre |
|---|---|---|
| `EVT_WIN` | **+1 000** | Acusación correcta que resuelve el sobre |
| `EVT_WIN_EFFICIENCY` | **+0 a +500** | Solo junto con `EVT_WIN`; premia resolver con pocos turnos propios |
| `EVT_SURVIVE` | **+200** | Llegar al final sin ser eliminado (si otro gana) |
| `EVT_SUGGESTION` | **+10** (cap 5×/partida) | Sugerencia lógicamente válida (nueva combinación, cartas existentes) |
| `EVT_REFUTATION` | **+15** | Refutar con éxito la sugerencia de un rival |
| `EVT_WRONG_ACCUSATION` | **−150** | Acusación incorrecta → además elimina al equipo de la partida |
| `EVT_PASS` | **−5** | Pase voluntario |
| `EVT_TIMEOUT` | **−20** | El agente no responde en el tiempo límite |
| `EVT_INVALID_CARD` | **−30** | Sugerencia/acusación con nombre de elemento incorrecto |
| `EVT_REDUNDANT_SUGGESTION` | **−20** | Sugerencia con combinación exacta ya intentada en la partida |
| `EVT_INVALID_FORMAT` | **−25** | Respuesta del agente con formato JSON incorrecto |

**Fórmula de bonificación por eficiencia** (solo para el ganador):

$$EVT\_WIN\_EFFICIENCY = \max\left(0,\; 500 - (T - T_{min}) \times 25\right)$$

donde $T$ es el número de turnos propios jugados hasta la acusación correcta (inclusive) y $T_{min} = 2$.

**Implicaciones para el diseño del agente**:

- No acusar hasta tener certeza: una acusación incorrecta cuesta 150 pts y elimina al equipo.
- Variar sugerencias: repetir la misma combinación cuesta −20 pts.
- Responder siempre en formato JSON válido: un error de formato cuesta −25 pts y consume el turno.
- Refutar cuando sea posible: aporta +15 pts adicionales.
- Evitar pases innecesarios: cada pase cuesta −5 pts.

### 4.7 §8 — Inicio rápido

#### Plantilla Python (SDK MCP oficial)

```python
# agent.py — Agente mínimo Clue Arena con Python MCP SDK
# Requiere: pip install mcp

import json
import os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

ARENA_MCP_URL = os.environ["ARENA_MCP_URL"]   # https://<dominio>/api/mcp
TEAM_TOKEN    = os.environ["TEAM_MCP_TOKEN"]  # Token distribuido por la organización


async def play_turn(game_id: str, team_id: str) -> dict:
    """Decide la acción para el turno actual."""
    async with streamablehttp_client(
        ARENA_MCP_URL,
        headers={"Authorization": f"Bearer {TEAM_TOKEN}"},
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1. Leer estado de partida
            game_state_result = await session.call_tool(
                "get_game_state",
                {"game_id": game_id, "team_id": team_id},
            )
            game_state = json.loads(game_state_result.content[0].text)

            # 2. Leer memoria del agente
            memory_result = await session.call_tool(
                "get_agent_memory",
                {"game_id": game_id, "team_id": team_id},
            )
            memory = json.loads(memory_result.content[0].text).get("memory", {})

            # 3. Decidir acción (lógica del equipo — este ejemplo hace una sugerencia fija)
            action = {
                "action": "suggestion",
                "sospechoso": "Coronel Mustard",
                "arma": "Laptop Cifrada",
                "escenario": "El Laboratorio",
            }

            # 4. Actualizar memoria con nuevas deducciones
            memory["ultimaAccion"] = action
            await session.call_tool(
                "save_agent_memory",
                {"game_id": game_id, "team_id": team_id, "memory": memory},
            )

            return action


async def refute(game_id: str, team_id: str, sugerencia: dict) -> dict:
    """Decide qué carta mostrar para refutar, o indica que no puede."""
    async with streamablehttp_client(
        ARENA_MCP_URL,
        headers={"Authorization": f"Bearer {TEAM_TOKEN}"},
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            game_state_result = await session.call_tool(
                "get_game_state",
                {"game_id": game_id, "team_id": team_id},
            )
            game_state = json.loads(game_state_result.content[0].text)

            # Obtener propias cartas
            propias = next(
                (e["cartas"] for e in game_state["equipos"] if e["esPropio"]), []
            )
            cartas_sugerencia = [
                sugerencia["sospechoso"],
                sugerencia["arma"],
                sugerencia["escenario"],
            ]
            puede_refutar = [c for c in propias if c in cartas_sugerencia]

            if puede_refutar:
                return {"action": "show_card", "carta": puede_refutar[0]}
            return {"action": "cannot_refute"}
```

#### Plantilla TypeScript (SDK MCP oficial)

```typescript
// agent.ts — Agente mínimo Clue Arena con TypeScript MCP SDK
// Requiere: npm install @modelcontextprotocol/sdk

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ARENA_MCP_URL = process.env.ARENA_MCP_URL!;
const TEAM_TOKEN    = process.env.TEAM_MCP_TOKEN!;

function makeClient() {
  return new Client(
    { name: "clue-arena-agent", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

export async function playTurn(gameId: string, teamId: string): Promise<object> {
  const transport = new StreamableHTTPClientTransport(new URL(ARENA_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${TEAM_TOKEN}` } },
  });
  const client = makeClient();
  await client.connect(transport);

  // 1. Estado de partida
  const gsResult = await client.callTool({ name: "get_game_state", arguments: { game_id: gameId, team_id: teamId } });
  const gameState = JSON.parse((gsResult.content[0] as { text: string }).text);

  // 2. Memoria del agente
  const memResult = await client.callTool({ name: "get_agent_memory", arguments: { game_id: gameId, team_id: teamId } });
  const memory = JSON.parse((memResult.content[0] as { text: string }).text).memory ?? {};

  // 3. Decidir acción (lógica del equipo)
  const action = {
    action: "suggestion" as const,
    sospechoso: "Coronel Mustard",
    arma: "Laptop Cifrada",
    escenario: "El Laboratorio",
  };

  // 4. Guardar memoria actualizada
  memory.ultimaAccion = action;
  await client.callTool({ name: "save_agent_memory", arguments: { game_id: gameId, team_id: teamId, memory } });

  await client.close();
  return action;
}
```

> Las plantillas implementan el **agente mínimo** (siempre hace la misma sugerencia). El valor diferencial viene de la lógica de razonamiento del equipo: LLM, reglas, combinatoria, etc.

### 4.8 §9 — Registro del agente

Una vez desplegado el agente en un servidor accesible desde internet:

1. Acceder a la plataforma con las credenciales corporativas del equipo.
2. Navegar a **Mi Equipo** → sección **Agente**.
3. Introducir la URL del endpoint del agente (debe responder a peticiones POST con JSON-RPC del protocolo MCP).
4. Pulsar **Guardar y verificar conexión** — la plataforma realizará un health-check y mostrará el resultado.

> El endpoint del agente debe ser accesible desde los servidores de la plataforma. Los agentes locales (localhost) no son válidos para el evento, pero sí para desarrollo usando el entorno local con `DISABLE_AUTH=true`.

### 4.9 §10 — Preguntas frecuentes y errores comunes

| Error / Situación | Causa probable | Solución |
|---|---|---|
| `EVT_INVALID_FORMAT` en todos los turnos | Respuesta del agente no es JSON plano o no incluye el campo `action` | Revisar que se devuelve exactamente el objeto `AgentResponse` sin envolturas extra |
| `EVT_INVALID_CARD` en la primera sugerencia | Nombre de sospechoso/arma/escenario con mayúscula o tilde distinta | Comparar con la tabla canónica de §6; copiar literalmente los nombres |
| El agente recibe `historial: []` siempre | Problema conocido del motor (RFC G003 §1, bug crítico) | Pendiente de corrección; el agente debe tratar el historial como posiblemente vacío en versiones tempranas del entorno |
| Token 401 Unauthorized | `TEAM_MCP_TOKEN` incorrecto o expirado | Verificar que el valor no tiene espacios y que se envía como `Bearer <token>` |
| `cannot_refute` cuando el agente sí tiene carta | La lógica de comparación no coincide exactamente los nombres de las cartas | Los nombres en `cartas` de `GameStateView` son idénticos a los de la tabla canónica — usar comparación de cadenas exacta (`===`) |
| Timeout frecuente | El LLM tarda más del límite permitido | Reducir el tamaño del prompt / número de herramientas llamadas; usar modelo más rápido para decidir |
| `EVT_REDUNDANT_SUGGESTION` | Se repite la misma tripla (sospechoso + arma + escenario) | Trackear en memoria del agente qué combinaciones ya se han sugerido |

---

## 5. Diseño de la pantalla (layout y componentes)

### 5.1 Estructura de componentes

```
src/app/instrucciones/
├── page.tsx                    ← Server Component raíz
└── layout.tsx                  ← InstructionsLayout (sin AppShell)

src/components/instructions/
├── InstructionsLayout.tsx      ← Layout con sidebar de TOC
├── InstructionsHero.tsx        ← Hero con identidad del evento
├── SectionWrapper.tsx          ← Sección con anchor y padding estándar
├── CodeBlock.tsx               ← Bloque de código con sintaxis highlight y botón copiar
├── ElementsTable.tsx           ← Tabla de sospechosos / armas / escenarios
├── ScoringTable.tsx            ← Tabla de eventos puntuables
├── TableOfContents.tsx         ← TOC fijo en sidebar (Client Component — scroll tracking)
└── AgentResponseDiagram.tsx    ← Diagrama de secuencia del ciclo de turno
```

> `TableOfContents.tsx` es el único componente que requiere `"use client"` (para resaltar la sección activa al hacer scroll). El resto son Server Components.

### 5.2 Layout en pantallas ≥ 1280 px

```
┌────────────────────────────────────────────────────────────────────┐
│  NAVBAR (minimal: logo + "← Volver a la plataforma")              │
├─────────────────────────────────┬──────────────────────────────────┤
│  CONTENIDO PRINCIPAL (prose)    │  TABLA DE CONTENIDOS (sticky)    │
│                                 │                                  │
│  §1 Introducción                │  §1 Introducción                 │
│  §2 Cómo funciona...            │  §2 Cómo funciona...             │
│  §3 Contrato MCP                │  §3 Contrato MCP           [●]   │
│  §4 Herramientas                │  §4 Herramientas                 │
│  §5 Respuesta del agente        │  §5 Respuesta del agente         │
│  §6 Elementos del juego         │  §6 Elementos del juego          │
│  §7 Puntuación                  │  §7 Puntuación                   │
│  §8 Inicio rápido               │  §8 Inicio rápido                │
│  §9 Registro                    │  §9 Registro                     │
│  §10 FAQ                        │  §10 FAQ                         │
│                                 │                                  │
└─────────────────────────────────┴──────────────────────────────────┘
```

### 5.3 Layout en pantallas < 768 px (móvil)

- Sin sidebar de TOC; se sustituye por un desplegable fijo en la parte superior.
- Los bloques de código tienen scroll horizontal.
- Las tablas colapsan con scroll horizontal.

---

## 6. Modificaciones en el middleware

La ruta `/instrucciones` debe excluirse del matcher del middleware de sesión:

```typescript
// src/middleware.ts — fragmento relevante
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/mcp|instrucciones).*)',
  ],
};
```

No se requiere ningún otro cambio en el middleware — la página no llama a `auth()`.

---

## 7. Consideraciones de seguridad

| Aspecto | Control |
|---|---|
| Exposición de tokens | La página no muestra ningún token ni credencial. El `TEAM_MCP_TOKEN` se distribuye por canal fuera de la plataforma. |
| Información competitiva | La página describe el contrato técnico público, no el estado de ninguna partida ni las cartas de ningún equipo. |
| Contenido estático | Al ser Server Component puro sin fetch en runtime, no hay superficie de ataque de SSR injection. |
| Sin formularios | La página no acepta input de usuario, no hay riesgo de XSS ni CSRF. |
| Robots/indexación | Añadir `<meta name="robots" content="noindex">` para evitar indexación accidental en buscadores públicos (el evento es interno). |

---

## 8. Testing

| Tipo | Descripción | Archivo |
|---|---|---|
| E2E smoke | La ruta `/instrucciones` devuelve HTTP 200 sin credenciales | `e2e/smoke.spec.ts` (añadir caso) |
| E2E accesibilidad | La página tiene heading `h1` y las tablas tienen `<caption>` | `e2e/instrucciones.spec.ts` |
| Unit | `ElementsTable` renderiza los 21 elementos canónicos | `src/tests/ElementsTable.test.tsx` |
| Unit | Los nombres canónicos en la página coinciden con las constantes de `src/types/domain.ts` | `src/tests/canonical-names.test.ts` |

> El test de nombres canónicos es crítico: si los elementos mostrados en la página divergen de las constantes del motor, los equipos construirán agentes que fallarán con `EVT_INVALID_CARD`.

---

## 9. Trabajo pendiente (TODOs)

| ID | Descripción | Bloqueado por |
|---|---|---|
| TODO-F013-01 | Confirmar nombres canónicos de armas con el brief del evento (RFC F010 pendiente de cierre) | RFC F010 |
| TODO-F013-02 | Definir el tiempo límite de respuesta por turno (timeout → `EVT_TIMEOUT`) y publicarlo en §7 | Pendiente de decisión operativa |
| TODO-F013-03 | Añadir sección §2.5 con diagrama de secuencia del modo `refute` | — |
| TODO-F013-04 | Verificar que el SDK Python `mcp` 1.x soporta `streamablehttp_client` con `headers` custom | Requiere prueba en entorno real |
| TODO-F013-05 | Añadir ejemplos de salida de `get_game_state` para el modo `refute` (los parámetros que el motor pasa al agente) | RFC G003 |

---

## 10. Preguntas abiertas (OPENQs)

| ID | Pregunta | Impacto |
|---|---|---|
| OPENQ-F013-01 | ¿Habrá un entorno de sandbox donde los equipos puedan probar su agente antes del evento sin cargar la plataforma de producción? | Si sí, añadir §8.3 con instrucciones de conexión al sandbox |
| OPENQ-F013-02 | ¿El `AgentRequest` que recibe el agente incluye `game_id` y `team_id` en el cuerpo, o el agente los infiere del token? | Determina cómo se documenta el contrato de invocación |
| OPENQ-F013-03 | ¿Los equipos pueden usar cualquier lenguaje/framework para su agente, o hay restricciones corporativas (p.ej. no servicios externos)? | Cambia la sección de inicio rápido y los avisos legales/corporativos |
| OPENQ-F013-04 | ¿La página `/instrucciones` debe estar disponible antes de que los equipos se registren (pública en internet) o solo en la red corporativa? | Determina si añadir `noindex` basta o si se necesita restricción de red |

---

## Apéndice A — Dependencias de implementación

```
F013 depende de:
├── F001  Estructura Next.js + middleware
├── F003  Hero visual e identidad visual (reutiliza assets e identidad)
├── F006  Plantilla Python/TS del agente local (base de las plantillas de §8)
├── F007  Descripción del ciclo de turno y herramientas MCP expuestas
├── F010  Nombres canónicos de elementos del juego (§6 depende de que F010 esté cerrado)
├── G001  Sistema de puntuación completo (§7)
├── G002  Reglas del pase voluntario (incluido en §5, tipo de acción `pass`)
└── G003  Modelo de información del agente (§4, nota sobre historial y cartaMostrada)
```
