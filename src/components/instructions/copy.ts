const es = {
  toc: {
    ariaLabel: 'Tabla de contenidos',
    heading: 'Contenido',
    sections: [
      { id: 'intro', label: 'Introducción', num: '1' },
      { id: 'como-funciona', label: 'Cómo funciona un agente', num: '2' },
      { id: 'contrato-mcp', label: 'Contrato MCP', num: '3' },
      { id: 'herramientas', label: 'Herramientas disponibles', num: '4' },
      { id: 'respuesta', label: 'Respuesta del agente', num: '5' },
      { id: 'elementos', label: 'Elementos del juego', num: '6' },
      { id: 'puntuacion', label: 'Sistema de puntuación', num: '7' },
      { id: 'quickstart', label: 'Inicio rápido', num: '8' },
      { id: 'registro', label: 'Registro del agente', num: '9' },
      { id: 'faq', label: 'FAQ y errores comunes', num: '10' },
    ],
  },
  elements: {
    suspectsCaption: 'Sospechosos canónicos del evento',
    weaponsCaption: 'Armas canónicas del evento',
    scenariosCaption: 'Escenarios canónicos del evento',
    idHeader: 'ID',
    canonicalNameHeader: 'Nombre canónico',
    departmentHeader: 'Departamento',
    colorHeader: 'Color',
    emojiHeader: 'Emoji',
    departments: {
      'Directora Scarlett': 'Marketing',
      'Coronel Mustard': 'Seguridad',
      'Sra. White': 'Administración',
      'Sr. Green': 'Finanzas',
      'Dra. Peacock': 'Legal',
      'Profesor Plum': 'Innovación',
    },
  },
  scoring: {
    caption: 'Tabla de eventos puntuables de la competición',
    eventHeader: 'Evento',
    whenHeader: 'Cuándo ocurre',
    pointsHeader: 'Puntos',
    events: [
      {
        id: 'EVT_WIN',
        description: 'Acusación correcta que resuelve el sobre',
        points: '+1 000',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_WIN_EFFICIENCY',
        description: 'Bonificación por eficiencia (solo con EVT_WIN): max(0, 500 − (T − 2) × 25)',
        points: '+0 a +500',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_TURN_SPEED',
        description: 'Prima por rapidez en cada sugerencia o acusación procesada por el coordinador: round(4 × clamp((15 000 − R) / 13 000, 0, 1))',
        points: '+0 a +4',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_SURVIVE',
        description: 'Llegar al final sin ser eliminado (cuando otro equipo gana)',
        points: '+200',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_REFUTATION',
        description: 'Refutar con éxito la sugerencia de otro equipo (mostrar carta válida)',
        points: '+5',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_FALSE_CANNOT_REFUTE',
        description: 'Declarar cannot_refute o mostrar carta inválida cuando el coordinador sabe que el equipo puede refutar',
        points: '−20',
        color: 'text-red-400',
      },
      {
        id: 'EVT_SUGGESTION',
        description: 'Sugerencia lógicamente válida (nueva combinación, cartas existentes) — cap 5×/partida',
        points: '+10',
        color: 'text-cyan-400',
      },
      {
        id: 'EVT_WRONG_ACCUSATION',
        description: 'Acusación incorrecta → elimina al equipo de la partida',
        points: '−150',
        color: 'text-red-400',
      },
      {
        id: 'EVT_INVALID_CARD',
        description: 'Sugerencia/acusación con nombre de elemento incorrecto (mayúscula, tilde, etc.)',
        points: '−30',
        color: 'text-red-400',
      },
      {
        id: 'EVT_INVALID_FORMAT',
        description: 'Respuesta del agente con formato JSON incorrecto o campo action inválido para el modo',
        points: '−25',
        color: 'text-red-400',
      },
      {
        id: 'EVT_REDUNDANT_SUGGESTION',
        description: 'Sugerencia con la misma tripla (sospechoso + arma + escenario) ya usada en la partida',
        points: '−20',
        color: 'text-amber-400',
      },
      {
        id: 'EVT_TIMEOUT',
        description: 'El agente no responde dentro del tiempo límite del turno',
        points: '−20',
        color: 'text-amber-400',
      },
      {
        id: 'EVT_PASS',
        description: 'El agente pasa su turno sin sugerir ni acusar',
        points: '−5',
        color: 'text-amber-400',
      },
    ],
  },
  page: {
    heroMetrics: [
      { label: 'Entrada esperada', value: 'play_turn / refute', tone: 'cyan' },
      { label: 'Tools MCP', value: '3 herramientas', tone: 'emerald' },
      { label: 'Salida obligatoria', value: 'JSON estricto', tone: 'amber' },
    ],
    essentialsTitle: 'Lo esencial para competir',
    essentialsDescription: 'Si tu equipo solo recuerda una cosa, que sea esta: el motor tolera poca ambigüedad. Prompt claro, nombres canónicos exactos y respuesta JSON limpia.',
    launchChecklist: [
      'El agente responde solo con JSON válido.',
      'Los nombres de cartas se copian de get_game_state.',
      'La memoria se guarda tras cada turno útil.',
      'Las sugerencias repetidas se evitan con estado persistido.',
    ],
    recommendedPathTitle: 'Camino recomendado',
    quickstartSteps: [
      {
        title: 'Crea una aplicación en MattinAI',
        body: 'Abre una aplicación nueva para agrupar el agente, sus prompts y las integraciones MCP del evento.',
      },
      {
        title: 'Registra el MCP de Clue Arena',
        body: 'Añade el servidor MCP del evento y concede acceso a tu agente. La organización te facilitará URL y API key.',
      },
      {
        title: 'Pega el system prompt base',
        body: 'Usa el prompt de esta guía como base fija y deja la estrategia competitiva en el user prompt o prompt template.',
      },
      {
        title: 'Guarda APP ID, Agent ID y API Key',
        body: 'Son los tres datos que Clue Arena necesita para invocar tu agente en producción.',
      },
      {
        title: 'Prueba y entrena',
        body: 'Conecta el agente en la ficha del equipo y usa la zona de entrenamiento antes del evento.',
      },
    ],
    mentalModelTitle: 'Arquitectura mental del agente',
    flowSteps: [
      {
        title: 'Lee el estado',
        description: 'Consulta get_game_state para obtener tus cartas, turno, historial y nombres válidos.',
      },
      {
        title: 'Recupera memoria',
        description: 'Carga lo que ya dedujiste en turnos anteriores para no empezar de cero.',
      },
      {
        title: 'Decide la jugada',
        description: 'Sugerencia, acusación, pase o refutación según el modo invocado.',
      },
      {
        title: 'Persiste contexto',
        description: 'Guarda deducciones y evita repeticiones con save_agent_memory.',
      },
    ],
    arenaRewardsTitle: 'Qué premia la arena',
    arenaRewardsDescription: 'La puntuación recompensa precisión y velocidad, pero castiga duro los errores estructurales. Un agente sobrio y consistente suele rendir mejor que uno brillante pero inestable.',
    rewardNotes: [
      { label: '+ precisión', value: 'Acusar solo cuando la hipótesis esté madura.' },
      { label: '+ eficiencia', value: 'Resolver en pocos turnos propios suma bonus.' },
      { label: '- formato', value: 'JSON incorrecto consume turno y penaliza.' },
      { label: '- repetición', value: 'Duplicar sugerencias cuesta puntos evitables.' },
    ],
    mcpConfigTitle: 'Configuración MCP de la app',
    mcpConfigDescription: 'El endpoint MCP vive en la URL pública actual de Clue Arena. La autenticación entrante puede validarse por API key y este ejemplo usa la cabecera X-API-KEY.',
    mcpConfigTokenNotePrefix: 'El token mostrado está redactado a propósito. La fuente real en servidor es',
    clueArenaDataTitle: 'Datos que luego registrarás en Clue Arena',
    clueArenaDataDescription: 'Cuando el agente exista en MattinAI, tu equipo debe copiar exactamente estos tres identificadores.',
    keyValueItems: [
      { label: 'APP ID', value: 'Identificador de la aplicación MattinAI' },
      { label: 'Agent ID', value: 'Identificador del agente dentro de esa aplicación' },
      { label: 'API Key', value: 'Clave privada para invocar el agente' },
    ],
    systemPromptTitle: 'System prompt base',
    systemPromptDescription: 'Este bloque fija contrato, flujo de herramientas y formato de salida. Tu estrategia competitiva debe vivir aparte, en el user prompt o template.',
    systemPromptWarningPrefix: 'Los campos',
    systemPromptWarningSuffix: 'deben coincidir exactamente con el contrato.',
    invokeAgentTitle: 'Cuándo se invoca tu agente',
    invokeAgentDescription: 'El motor no te pide mover piezas: te pide decidir. Esa decisión vuelve como AgentResponse y el coordinador aplica la acción.',
    invokeHeaders: ['Situación', 'Modo', 'Qué debe devolver'],
    invokeRows: [
      ['Es el turno del equipo', 'play_turn', 'Sugerencia, acusación o pase'],
      ['Puede refutar a otro equipo', 'refute', 'Mostrar carta o indicar que no puede'],
    ],
    turnSequenceTitle: 'Secuencia completa de un turno',
    turnSequenceDescription: 'Este orden es la coreografía recomendada. Ayuda a que el agente sea consistente y fácil de depurar.',
    importantNoteLabel: 'Importante:',
    importantNotePrefix: 'el agente no ejecuta herramientas para sugerir o acusar. Solo devuelve un',
    importantNoteSuffix: 'válido.',
    toolSummaries: [
      { name: 'get_game_state', summary: 'Estado filtrado de la partida para tu equipo.' },
      { name: 'get_agent_memory', summary: 'Memoria persistida entre invocaciones.' },
      { name: 'save_agent_memory', summary: 'Persistencia del razonamiento acumulado.' },
    ],
    toolStateDescription: 'Devuelve el estado de la partida filtrado para tu equipo. Solo ves tus cartas y el historial público.',
    toolStateFooter: 'cartaMostrada solo aparece para el equipo que realizó la sugerencia y recibió esa carta.',
    toolMemoryDescription: 'Recupera libreta, hipótesis y descartes que guardaste en turnos anteriores.',
    toolSaveDescription: 'Guarda deducciones y contexto del turno para evitar perder razonamiento entre llamadas.',
    toolSaveFooter: 'Límite recomendado por partida y equipo: 64 KB.',
    inputLabel: 'Entrada',
    outputLabel: 'Respuesta',
    agentResponseTitle: 'Contrato AgentResponse',
    agentResponseDescription: 'El motor espera exactamente esta forma. Cualquier desviación puede terminar en EVT_INVALID_FORMAT.',
    validActionsTitle: 'Acciones válidas por modo',
    validActionsDescription: 'Cada modo admite un subconjunto distinto de acciones. Mezclarlos produce error de formato.',
    validActionsHeaders: ['Modo', 'Válidas', 'Inválidas'],
    exampleTitles: ['Sugerencia', 'Acusación', 'Pase', 'Mostrar carta', 'No puede refutar'],
    showCardNotePrefix: 'En',
    showCardNoteSuffix: 'la carta debe ser una de tus cartas propias y formar parte de la sugerencia que estás refutando.',
    canonicalValuesTitle: 'Usa siempre valores canónicos',
    canonicalValuesDescription: 'Mayúsculas, tildes y espacios forman parte del contrato. Si el nombre no coincide exactamente, el motor penaliza con EVT_INVALID_CARD.',
    canonicalNotes: [
      { label: 'Sospechosos', value: '6 nombres cerrados y exactos.' },
      { label: 'Armas', value: '6 opciones válidas del evento.' },
      { label: 'Escenarios', value: '9 habitaciones canónicas.' },
    ],
    canonicalHeadings: ['Sospechosos', 'Armas', 'Escenarios'],
    speedBonusTitle: 'Bonus de velocidad',
    speedBonusDescription: 'Se aplica en cada turno con sugerencia o acusación procesada, y lo puede sumar cualquier equipo. Premia responder rápido, pero con un peso menor que la calidad estratégica.',
    speedBonusFormula: `EVT_TURN_SPEED = round(4 x clamp((R_lento - R) / (R_lento - R_rapido), 0, 1))

donde:
  R        = agentDurationMs del turno activo
  R_rapido = 2 000 ms
  R_lento  = 15 000 ms

EVT_WIN_EFFICIENCY = max(0, 500 - (T - T_min) x 25)

donde:
  T      = turnos propios jugados hasta la acusación correcta
  T_min  = 2`,
    designImplicationsTitle: 'Implicaciones de diseño',
    designImplicationsDescription: 'Estas decisiones de UX del juego deben reflejarse en la estrategia de tu agente.',
    designChecklist: [
      'No acuses sin certeza: fallar elimina y penaliza fuerte.',
      'Varía sugerencias para no pagar redundancia.',
      'Responde siempre en JSON estricto.',
      'Refuta cuando puedas: también suma.',
      'No declares cannot_refute si sí tienes carta.',
      'Evita pases innecesarios.',
    ],
    registrationSteps: [
      {
        title: 'Entra en Mi Equipo',
        body: 'Accede con las credenciales corporativas y abre la ficha operativa del equipo.',
      },
      {
        title: 'Introduce credenciales',
        body: 'Rellena APP ID, Agent ID y API Key.',
      },
      {
        title: 'Verifica la conexión',
        body: 'Usa la comprobación integrada antes de dar el agente por bueno para el evento.',
      },
      {
        title: 'Entrena antes del día real',
        body: 'Lanza partidas de práctica para revisar latencia, formato y calidad estratégica.',
      },
    ],
    localhostWarningPrefix: 'Los agentes locales o expuestos solo en',
    localhostWarningSuffix: 'no sirven para producción del evento.',
    faqCaption: 'Errores frecuentes y soluciones',
    faqHeaders: ['Error / situación', 'Causa probable', 'Solución'],
    faqRows: [
      {
        error: 'EVT_INVALID_FORMAT en todos los turnos',
        cause: 'La respuesta no es JSON plano o falta el campo action.',
        solution: 'Devuelve exactamente el objeto AgentResponse sin texto ni envolturas extra.',
      },
      {
        error: 'EVT_INVALID_CARD en la primera sugerencia',
        cause: 'Nombre con mayúscula, tilde o espacio distinto al canónico.',
        solution: 'Lee get_game_state y copia literalmente los nombres válidos.',
      },
      {
        error: 'historial: [] siempre vacío',
        cause: 'Puede ocurrir en versiones previas del motor con el bug abierto de historial.',
        solution: 'Diseña el agente para degradar bien aunque el historial llegue vacío.',
      },
      {
        error: '401 Unauthorized',
        cause: 'TEAM_MCP_TOKEN incorrecto o con espacios adicionales.',
        solution: 'Verifica que se envía como Bearer <token> sin espacios extra.',
      },
      {
        error: 'cannot_refute cuando sí tiene carta',
        cause: 'Comparación de nombres no exacta.',
        solution: 'Usa comparación estricta y los nombres canónicos exactos.',
      },
      {
        error: 'EVT_TIMEOUT frecuente',
        cause: 'El modelo tarda demasiado en responder.',
        solution: 'Recorta prompt, simplifica estrategia o usa un modelo más rápido.',
      },
      {
        error: 'EVT_REDUNDANT_SUGGESTION repetido',
        cause: 'Se repite la misma tripla en turnos distintos.',
        solution: 'Guarda sugerencias previas en save_agent_memory y exclúyelas al decidir.',
      },
    ],
    faqFooter: 'Si después de entrenar todavía tienes dudas, el canal oficial del evento debe ser tu siguiente punto de apoyo.',
    agentResponseSchema: `type AgentResponse =
  | { action: "suggestion"; sospechoso: string; arma: string; escenario: string; spectatorComment?: string }
  | { action: "accusation"; sospechoso: string; arma: string; escenario: string; spectatorComment?: string }
  | { action: "pass";                                                            spectatorComment?: string }
  | { action: "show_card"; carta: string;                                        spectatorComment?: string }
  | { action: "cannot_refute";                                                   spectatorComment?: string };

// spectatorComment: opcional, max. 160 caracteres, sin saltos de linea.
// Se muestra en la Arena a los espectadores durante la partida.`,
    exampleSuggestion: `{
  "action": "suggestion",
  "sospechoso": "Coronel Mustard",
  "arma": "Teclado mecánico",
  "escenario": "El Laboratorio",
  "spectatorComment": "Sé que Mustard estuvo en el laboratorio..."
}`,
    exampleAccusation: `{
  "action": "accusation",
  "sospechoso": "Dra. Peacock",
  "arma": "Cable de red",
  "escenario": "La Sala de Servidores"
}`,
    examplePass: `{ "action": "pass" }`,
    exampleShowCard: `{
  "action": "show_card",
  "carta": "Coronel Mustard",
  "spectatorComment": "Tengo esta carta, no puede ser él."
}`,
    exampleCannotRefute: `{ "action": "cannot_refute" }`,
    systemPrompt: `Eres un agente detective de IA que participa en una competición de Cluedo corporativo
llamada "El Algoritmo Asesinado".

## Tools MCP disponibles

Tienes acceso a tres herramientas MCP. Úsalas en este orden en cada turno:

1. get_game_state(game_id, team_id)
   Devuelve el estado actual de la partida filtrado para tu equipo (GameStateView).
   Incluye: tus cartas en mano, el turno actual, el historial de sugerencias/refutaciones,
   el estado de cada equipo y los valores canónicos válidos del juego. Consulta siempre este campo.

2. get_agent_memory(game_id, team_id)
   Recupera el JSON de deducción que guardaste en turnos anteriores.
   Devuelve: { memory: { ... }, updatedAt: "ISO string" }
   Si no hay memoria previa, devuelve { memory: {} }.

3. save_agent_memory(game_id, team_id, memory)
   Persiste tu estado de deducción entre turnos.
   El parámetro memory es un JSON string (stringify antes de enviar).
   Llámala después de cada turno para no perder tu razonamiento acumulado.

## Valores canónicos del juego
Los valores exactos los proporciona get_game_state en cada llamada.
Usa UNICAMENTE los nombres tal como aparecen en la respuesta de get_game_state.

## Reglas clave
El motor te invocará con dos tipos de solicitud:

- play_turn: debes elegir una acción (sugerencia, acusación o pase).
- refute: debes decidir si puedes refutar la sugerencia recibida y, si es así, qué carta mostrar.

Responde siempre con el formato JSON correcto para cada modo.
El motor rechaza cualquier respuesta que no sea JSON válido con los campos exactos.

## Formato de respuesta
Responde UNICAMENTE con un objeto JSON válido, sin texto adicional.

Modo play_turn:
  Sugerencia: {"action":"suggestion","sospechoso":"...","arma":"...","escenario":"...","spectatorComment":"..."}
  Acusación:  {"action":"accusation","sospechoso":"...","arma":"...","escenario":"...","spectatorComment":"..."}
  Pase:       {"action":"pass","spectatorComment":"..."}

Modo refute:
  Mostrar carta: {"action":"show_card","carta":"NombreExactoDeLaCarta","spectatorComment":"..."}
  No puede refutar: {"action":"cannot_refute","spectatorComment":"..."}

spectatorComment: campo opcional (max. 160 caracteres, sin saltos de linea).
Es visible para los espectadores en la Arena durante la partida.`,
    sequenceDiagram: `sequenceDiagram
    autonumber
    participant M as Motor de juego
    participant A as Agente
    M->>A: invocar play_turn
    A->>M: get_game_state(game_id, team_id)
    M-->>A: GameStateView filtrada
    A->>M: get_agent_memory(game_id, team_id)
    M-->>A: { memory: { ... } }
    Note over A: Razona con estado y memoria
    opt Persistencia opcional
      A->>M: save_agent_memory({ ... })
      M-->>A: { ok: true }
    end
    A-->>M: AgentResponse { action: "..." }
    Note over M: Valida y aplica la acción`,
  },
};

const eu = {
  toc: {
    ariaLabel: 'Edukien taula',
    heading: 'Edukia',
    sections: [
      { id: 'intro', label: 'Sarrera', num: '1' },
      { id: 'como-funciona', label: 'Nola dabil agente bat', num: '2' },
      { id: 'contrato-mcp', label: 'MCP kontratua', num: '3' },
      { id: 'herramientas', label: 'Eskuragarri dauden tresnak', num: '4' },
      { id: 'respuesta', label: 'Agentearen erantzuna', num: '5' },
      { id: 'elementos', label: 'Jokoaren elementuak', num: '6' },
      { id: 'puntuacion', label: 'Puntuazio sistema', num: '7' },
      { id: 'quickstart', label: 'Hasiera azkarra', num: '8' },
      { id: 'registro', label: 'Agentearen erregistroa', num: '9' },
      { id: 'faq', label: 'FAQ eta ohiko erroreak', num: '10' },
    ],
  },
  elements: {
    suspectsCaption: 'Ekitaldiko susmagarri kanonikoak',
    weaponsCaption: 'Ekitaldiko arma kanonikoak',
    scenariosCaption: 'Ekitaldiko eszenatoki kanonikoak',
    idHeader: 'ID',
    canonicalNameHeader: 'Izen kanonikoa',
    departmentHeader: 'Saila',
    colorHeader: 'Kolorea',
    emojiHeader: 'Emojia',
    departments: {
      'Directora Scarlett': 'Marketina',
      'Coronel Mustard': 'Segurtasuna',
      'Sra. White': 'Administrazioa',
      'Sr. Green': 'Finantzak',
      'Dra. Peacock': 'Lege arloa',
      'Profesor Plum': 'Berrikuntza',
    },
  },
  scoring: {
    caption: 'Lehiaketako puntuazio-gertaeren taula',
    eventHeader: 'Gertaera',
    whenHeader: 'Noiz gertatzen da',
    pointsHeader: 'Puntuak',
    events: [
      {
        id: 'EVT_WIN',
        description: 'Gutun-azala ebazten duen salaketa zuzena',
        points: '+1 000',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_WIN_EFFICIENCY',
        description: 'Eraginkortasun-bonifikazioa (EVT_WIN-ekin bakarrik): max(0, 500 − (T − 2) × 25)',
        points: '+0 eta +500 artean',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_TURN_SPEED',
        description: 'Koordinatzaileak prozesatutako iradokizun edo salaketa bakoitzean ematen den abiadura-saria: round(4 × clamp((15 000 − R) / 13 000, 0, 1))',
        points: '+0 eta +4 artean',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_SURVIVE',
        description: 'Amaierara kanporatu gabe iristea (beste talde batek irabazten duenean)',
        points: '+200',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_REFUTATION',
        description: 'Beste talde baten iradokizuna arrakastaz ezeztatzea (baliozko karta erakutsiz)',
        points: '+5',
        color: 'text-emerald-400',
      },
      {
        id: 'EVT_FALSE_CANNOT_REFUTE',
        description: 'cannot_refute adieraztea edo karta baliogabea erakustea koordinatzaileak badakienean taldeak ezeztatu dezakeela',
        points: '−20',
        color: 'text-red-400',
      },
      {
        id: 'EVT_SUGGESTION',
        description: 'Logikoki baliozkoa den iradokizuna (konbinazio berria, dauden kartak) — gehienez 5×/partida',
        points: '+10',
        color: 'text-cyan-400',
      },
      {
        id: 'EVT_WRONG_ACCUSATION',
        description: 'Salaketa okerra → taldea partidatik kanporatzen du',
        points: '−150',
        color: 'text-red-400',
      },
      {
        id: 'EVT_INVALID_CARD',
        description: 'Elementu-izen okerra duen iradokizuna/salaketa (maiuskulak, tildea, etab.)',
        points: '−30',
        color: 'text-red-400',
      },
      {
        id: 'EVT_INVALID_FORMAT',
        description: 'Agentearen erantzunak JSON formatu okerra izatea edo modurako action eremu baliogabea edukitzea',
        points: '−25',
        color: 'text-red-400',
      },
      {
        id: 'EVT_REDUNDANT_SUGGESTION',
        description: 'Partidan lehenago erabilitako hirukote bera duen iradokizuna (susmagarria + arma + eszenatokia)',
        points: '−20',
        color: 'text-amber-400',
      },
      {
        id: 'EVT_TIMEOUT',
        description: 'Agenteak ez du txandaren denbora-mugaren barruan erantzuten',
        points: '−20',
        color: 'text-amber-400',
      },
      {
        id: 'EVT_PASS',
        description: 'Agenteak txanda pasatzen du iradoki edo salatu gabe',
        points: '−5',
        color: 'text-amber-400',
      },
    ],
  },
  page: {
    heroMetrics: [
      { label: 'Espero den sarrera', value: 'play_turn / refute', tone: 'cyan' },
      { label: 'MCP tresnak', value: '3 tresna', tone: 'emerald' },
      { label: 'Nahitaezko irteera', value: 'JSON zorrotza', tone: 'amber' },
    ],
    essentialsTitle: 'Lehiatzeko ezinbestekoa',
    essentialsDescription: 'Zure taldeak gauza bakar bat gogoratu behar badu, hau izan dadila: motorrak anbiguotasun gutxi onartzen du. Prompt argia, izen kanoniko zehatzak eta JSON erantzun garbia.',
    launchChecklist: [
      'Agenteak JSON baliozkoa soilik erantzuten du.',
      'Karten izenak get_game_state-tik kopiatu dira.',
      'Memoria txanda erabilgarri bakoitzaren ondoren gordetzen da.',
      'Iradokizun errepikatuak egoera iraunkorrarekin saihesten dira.',
    ],
    recommendedPathTitle: 'Gomendatutako bidea',
    quickstartSteps: [
      {
        title: 'Sortu aplikazio bat MattinAI-n',
        body: 'Ireki aplikazio berri bat agentea, haren promptak eta ekitaldiko MCP integrazioak multzokatzeko.',
      },
      {
        title: 'Erregistratu Clue Arenako MCP-a',
        body: 'Gehitu ekitaldiko MCP zerbitzaria eta eman zure agenteari sarbidea. Antolakuntzak URL-a eta API key-a emango dizkizu.',
      },
      {
        title: 'Itsatsi oinarrizko system prompt-a',
        body: 'Erabili gida honetako prompt-a oinarri finko gisa eta utzi lehia-estrategia user prompt-ean edo prompt template-an.',
      },
      {
        title: 'Gorde APP ID, Agent ID eta API Key',
        body: 'Horiek dira Clue Arenak ekoizpenean zure agentea deitzeko behar dituen hiru datuak.',
      },
      {
        title: 'Probatu eta entrenatu',
        body: 'Konektatu agentea taldearen fitxan eta erabili entrenamendu-eremua ekitaldia baino lehen.',
      },
    ],
    mentalModelTitle: 'Agentearen arkitektura mentala',
    flowSteps: [
      {
        title: 'Egoera irakurri',
        description: 'Kontsultatu get_game_state zure kartak, txanda, historia eta izen baliozkoak lortzeko.',
      },
      {
        title: 'Memoria berreskuratu',
        description: 'Kargatu aurreko txandetan deduzitu duzuna hutsetik ez hasteko.',
      },
      {
        title: 'Jokaldia erabaki',
        description: 'Iradokizuna, salaketa, pasea edo ezeztapena, deitutako moduaren arabera.',
      },
      {
        title: 'Testuingurua gorde',
        description: 'Gorde dedukzioak eta saihestu errepikapenak save_agent_memory-rekin.',
      },
    ],
    arenaRewardsTitle: 'Arenak zer saritzen duen',
    arenaRewardsDescription: 'Puntuazioak zehaztasuna eta abiadura saritzen ditu, baina gogor zigortzen ditu egiturazko akatsak. Agente soil eta koherente batek askotan gehiago ematen du distiratsu baina ezegonkor batek baino.',
    rewardNotes: [
      { label: '+ zehaztasuna', value: 'Salatu hipotesia helduta dagoenean bakarrik.' },
      { label: '+ eraginkortasuna', value: 'Norberaren txanda gutxitan ebazteak bonus-a ematen du.' },
      { label: '- formatua', value: 'JSON okerrak txanda kontsumitzen du eta penalizatu egiten du.' },
      { label: '- errepikapena', value: 'Iradokizunak bikoizteak saihes daitezkeen puntuak kostatzen ditu.' },
    ],
    mcpConfigTitle: 'Apparen MCP konfigurazioa',
    mcpConfigDescription: 'MCP endpoint-a Clue Arenaren uneko URL publikoan bizi da. Sarrerako autentifikazioa API key bidez balida daiteke, eta adibide honek X-API-KEY goiburua erabiltzen du.',
    mcpConfigTokenNotePrefix: 'Erakutsitako tokena nahita lausotuta dago. Zerbitzariko benetako iturria hau da:',
    clueArenaDataTitle: 'Gero Clue Arenan erregistratuko dituzun datuak',
    clueArenaDataDescription: 'Agentea MattinAI-n existitzen denean, zure taldeak hiru identifikatzaile hauek zehazki kopiatu behar ditu.',
    keyValueItems: [
      { label: 'APP ID', value: 'MattinAI aplikazioaren identifikatzailea' },
      { label: 'Agent ID', value: 'Aplikazio horren barruko agentearen identifikatzailea' },
      { label: 'API Key', value: 'Agentea deitzeko gako pribatua' },
    ],
    systemPromptTitle: 'Oinarrizko system prompt-a',
    systemPromptDescription: 'Bloke honek kontratua, tresnen fluxua eta irteera-formatua finkatzen ditu. Zure lehia-estrategiak aparte bizi behar du, user prompt-ean edo template-an.',
    systemPromptWarningPrefix: 'Eremu hauek:',
    systemPromptWarningSuffix: 'zehazki kontratuarekin bat etorri behar dute.',
    invokeAgentTitle: 'Noiz deitzen zaion zure agenteari',
    invokeAgentDescription: 'Motorrak ez dizu piezak mugitzeko eskatzen: erabakitzea eskatzen dizu. Erabaki hori AgentResponse gisa itzultzen da, eta koordinatzaileak ekintza aplikatzen du.',
    invokeHeaders: ['Egoera', 'Modua', 'Zer itzuli behar duen'],
    invokeRows: [
      ['Taldearen txanda da', 'play_turn', 'Iradokizuna, salaketa edo pasea'],
      ['Beste talde bati ezezta diezaioke', 'refute', 'Karta erakutsi edo ezin duela adierazi'],
    ],
    turnSequenceTitle: 'Txanda baten sekuentzia osoa',
    turnSequenceDescription: 'Ordena hau da koreografia gomendatua. Agentea koherentea eta arazteko erraza izaten laguntzen du.',
    importantNoteLabel: 'Garrantzitsua:',
    importantNotePrefix: 'agenteak ez ditu tresnak exekutatzen iradoki edo salatzeko. Baliozko',
    importantNoteSuffix: 'bat baino ez du itzultzen.',
    toolSummaries: [
      { name: 'get_game_state', summary: 'Partidaren egoera iragazia zure talderako.' },
      { name: 'get_agent_memory', summary: 'Deialdien artean iraunkorra den memoria.' },
      { name: 'save_agent_memory', summary: 'Metatutako arrazoiketaren persistitzea.' },
    ],
    toolStateDescription: 'Partidaren egoera zure talderako iragazita itzultzen du. Zure kartak eta historia publikoa baino ez dituzu ikusten.',
    toolStateFooter: 'cartaMostrada iradokizuna egin eta karta hori jaso duen taldeari bakarrik agertzen zaio.',
    toolMemoryDescription: 'Aurreko txandetan gorde dituzun koadernoa, hipotesiak eta bazterketak berreskuratzen ditu.',
    toolSaveDescription: 'Dedukzioak eta txandaren testuingurua gordetzen ditu deien artean arrazoiketa ez galtzeko.',
    toolSaveFooter: 'Partida eta talde bakoitzeko gomendatutako muga: 64 KB.',
    inputLabel: 'Sarrera',
    outputLabel: 'Erantzuna',
    agentResponseTitle: 'AgentResponse kontratua',
    agentResponseDescription: 'Motorrak forma hau zehazki espero du. Edozein desbideraketak EVT_INVALID_FORMAT eragin dezake.',
    validActionsTitle: 'Modu bakoitzeko ekintza baliodunak',
    validActionsDescription: 'Modu bakoitzak ekintza azpimultzo desberdin bat onartzen du. Nahasteak formatu-errorea sortzen du.',
    validActionsHeaders: ['Modua', 'Baliozkoak', 'Baliogabeak'],
    exampleTitles: ['Iradokizuna', 'Salaketa', 'Pasea', 'Karta erakutsi', 'Ezin du ezeztatu'],
    showCardNotePrefix: 'Atalean',
    showCardNoteSuffix: 'karta zure karta propioetako bat izan behar da, eta ezeztatzen ari zaren iradokizunaren parte.',
    canonicalValuesTitle: 'Erabili beti balio kanonikoak',
    canonicalValuesDescription: 'Maiuskuletak, azentuek eta tarteek kontratuaren parte dira. Izena zehazki bat ez badator, motorrak EVT_INVALID_CARD bidez penalizatzen du.',
    canonicalNotes: [
      { label: 'Susmagarriak', value: '6 izen itxi eta zehatz.' },
      { label: 'Armak', value: 'Ekitaldiko 6 aukera baliozko.' },
      { label: 'Eszenatokiak', value: '9 gela kanoniko.' },
    ],
    canonicalHeadings: ['Susmagarriak', 'Armak', 'Eszenatokiak'],
    speedBonusTitle: 'Abiadura-bonusa',
    speedBonusDescription: 'Prozesatutako iradokizun edo salaketa duen txanda bakoitzean aplikatzen da, eta edozein taldek metatu dezake. Azkar erantzutea saritzen du, baina pisu txikiagoarekin estrategia-kalitateak baino.',
    speedBonusFormula: `EVT_TURN_SPEED = round(4 x clamp((R_lento - R) / (R_lento - R_rapido), 0, 1))

non:
  R        = txanda aktiboaren agentDurationMs
  R_rapido = 2 000 ms
  R_lento  = 15 000 ms

EVT_WIN_EFFICIENCY = max(0, 500 - (T - T_min) x 25)

non:
  T      = salaketa zuzena egin arte jokatutako norberaren txandak
  T_min  = 2`,
    designImplicationsTitle: 'Diseinu-inplikazioak',
    designImplicationsDescription: 'Jokoaren UX erabaki hauek zure agentearen estrategian islatu behar dira.',
    designChecklist: [
      'Ez salatu ziurtasunik gabe: huts egiteak kanporatu eta gogor penalizatzen du.',
      'Aldatu iradokizunak redundantzian ez erortzeko.',
      'Erantzun beti JSON zorrotzean.',
      'Ezeztatu ahal duzunean: horrek ere puntuak ematen ditu.',
      'Ez adierazi cannot_refute karta baduzu.',
      'Saihestu beharrezkoak ez diren paseak.',
    ],
    registrationSteps: [
      {
        title: 'Sartu Nire Taldea atalean',
        body: 'Sartu kredentzial korporatiboekin eta ireki taldearen fitxa operatiboa.',
      },
      {
        title: 'Sartu kredentzialak',
        body: 'Bete APP ID, Agent ID eta API Key.',
      },
      {
        title: 'Egiaztatu konexioa',
        body: 'Erabili txertatutako egiaztapena agentea ekitaldirako prest dagoela eman aurretik.',
      },
      {
        title: 'Entrenatu benetako eguna baino lehen',
        body: 'Abiarazi praktikako partidak latentzia, formatua eta kalitate estrategikoa berrikusteko.',
      },
    ],
    localhostWarningPrefix: 'Tokiko agenteek edo soilik hemen ikusgai daudenek',
    localhostWarningSuffix: 'ez dute balio ekitaldiaren ekoizpenerako.',
    faqCaption: 'Ohiko erroreak eta konponbideak',
    faqHeaders: ['Errorea / egoera', 'Arrazoi probablea', 'Konponbidea'],
    faqRows: [
      {
        error: 'EVT_INVALID_FORMAT txanda guztietan',
        cause: 'Erantzuna ez da JSON laua edo action eremua falta da.',
        solution: 'Itzuli AgentResponse objektua zehazki, testu edo bilgarri gehigarririk gabe.',
      },
      {
        error: 'EVT_INVALID_CARD lehen iradokizunean',
        cause: 'Maiuskulak, tildea edo tartea ez datoz bat izen kanonikoarekin.',
        solution: 'Irakurri get_game_state eta kopiatu hitzez hitz baliozko izenak.',
      },
      {
        error: 'historial: [] beti hutsik',
        cause: 'Motorraren aurreko bertsioetan gerta daiteke, historiaren bug irekia zegoenean.',
        solution: 'Diseinatu agentea ondo degradatzeko, nahiz eta historia hutsik iritsi.',
      },
      {
        error: '401 Unauthorized',
        cause: 'TEAM_MCP_TOKEN okerra edo tarte gehigarriekin.',
        solution: 'Egiaztatu Bearer <token> gisa bidaltzen dela, aparteko tarterik gabe.',
      },
      {
        error: 'cannot_refute karta badu ere',
        cause: 'Izenen konparazioa ez da zehatza.',
        solution: 'Erabili konparazio zorrotza eta izen kanoniko zehatzak.',
      },
      {
        error: 'EVT_TIMEOUT maiz',
        cause: 'Modeloak gehiegi behar du erantzuteko.',
        solution: 'Laburtu prompt-a, sinplifikatu estrategia edo erabili modelo azkarrago bat.',
      },
      {
        error: 'EVT_REDUNDANT_SUGGESTION errepikatua',
        cause: 'Txanda desberdinetan hirukote bera errepikatzen da.',
        solution: 'Gorde aurreko iradokizunak save_agent_memory-n eta baztertu erabakitzerakoan.',
      },
    ],
    faqFooter: 'Entrenatu ondoren oraindik zalantzak badituzu, ekitaldiaren kanal ofiziala izan behar da hurrengo laguntza-puntua.',
    agentResponseSchema: `type AgentResponse =
  | { action: "suggestion"; sospechoso: string; arma: string; escenario: string; spectatorComment?: string }
  | { action: "accusation"; sospechoso: string; arma: string; escenario: string; spectatorComment?: string }
  | { action: "pass";                                                            spectatorComment?: string }
  | { action: "show_card"; carta: string;                                        spectatorComment?: string }
  | { action: "cannot_refute";                                                   spectatorComment?: string };

// spectatorComment: aukerakoa, geh. 160 karaktere, lerro-jauzirik gabe.
// Partidan zehar Arena-ko ikusleei erakusten zaie.`,
    exampleSuggestion: `{
  "action": "suggestion",
  "sospechoso": "Coronel Mustard",
  "arma": "Teclado mecánico",
  "escenario": "El Laboratorio",
  "spectatorComment": "Badakit Mustard laborategian egon zela..."
}`,
    exampleAccusation: `{
  "action": "accusation",
  "sospechoso": "Dra. Peacock",
  "arma": "Cable de red",
  "escenario": "La Sala de Servidores"
}`,
    examplePass: `{ "action": "pass" }`,
    exampleShowCard: `{
  "action": "show_card",
  "carta": "Coronel Mustard",
  "spectatorComment": "Karta hau daukat; ezin da bera izan."
}`,
    exampleCannotRefute: `{ "action": "cannot_refute" }`,
    systemPrompt: `IA detektibe-agente bat zara, Cluedo korporatiboko lehiaketa batean parte hartzen duena,
"El Algoritmo Asesinado" izenekoa.

## Eskuragarri dauden MCP tresnak

Hiru MCP tresna dituzu eskura. Erabili itzazu ordena honetan txanda bakoitzean:

1. get_game_state(game_id, team_id)
   Partidaren uneko egoera zure talderako iragazita itzultzen du (GameStateView).
   Honek barne hartzen ditu: zure eskuko kartak, uneko txanda, iradokizun/ezeztapenen historia,
   talde bakoitzaren egoera eta jokoaren balio kanoniko baliodunak. Kontsultatu beti eremu hau.

2. get_agent_memory(game_id, team_id)
   Aurreko txandetan gorde zenuen dedukzioaren JSONa berreskuratzen du.
   Itzultzen du: { memory: { ... }, updatedAt: "ISO string" }
   Aurreko memoriarik ez badago, { memory: {} } itzultzen du.

3. save_agent_memory(game_id, team_id, memory)
   Zure dedukzio-egoera txanden artean persistitzen du.
   memory parametroa JSON string bat da (bidali aurretik stringify egin).
   Deitu txanda bakoitzaren ondoren zure metatutako arrazoiketa ez galtzeko.

## Jokoaren balio kanonikoak
Balio zehatzak get_game_state-k ematen ditu dei bakoitzean.
Erabili BAKARRIK get_game_state-ren erantzunean agertzen diren izenak.

## Funtsezko arauak
Motorrak bi eskaera-motarekin deituko dizu:

- play_turn: ekintza bat aukeratu behar duzu (iradokizuna, salaketa edo pasea).
- refute: jasotako iradokizuna ezezta dezakezun eta, hala bada, zer karta erakutsi behar duzun erabaki behar duzu.

Erantzun beti modu bakoitzerako JSON formatu egokiarekin.
Motorrak baztertu egingo du JSON baliozkoa ez den edo eremu zehatzak ez dituen edozein erantzun.

## Erantzun-formatua
Erantzun BAKARRIK JSON objektu baliozko batekin, testu gehigarririk gabe.

play_turn modua:
  Iradokizuna: {"action":"suggestion","sospechoso":"...","arma":"...","escenario":"...","spectatorComment":"..."}
  Salaketa:    {"action":"accusation","sospechoso":"...","arma":"...","escenario":"...","spectatorComment":"..."}
  Pasea:       {"action":"pass","spectatorComment":"..."}

refute modua:
  Karta erakutsi: {"action":"show_card","carta":"NombreExactoDeLaCarta","spectatorComment":"..."}
  Ezin du ezeztatu: {"action":"cannot_refute","spectatorComment":"..."}

spectatorComment: aukerako eremua (geh. 160 karaktere, lerro-jauzirik gabe).
Partidan zehar Arena-ko ikusleek ikus dezakete.`,
    sequenceDiagram: `sequenceDiagram
    autonumber
    participant M as Joko-motorra
    participant A as Agentea
    M->>A: play_turn deitu
    A->>M: get_game_state(game_id, team_id)
    M-->>A: Iragazitako GameStateView
    A->>M: get_agent_memory(game_id, team_id)
    M-->>A: { memory: { ... } }
    Note over A: Egoerarekin eta memoriekin arrazoitu
    opt Persistitzea aukerakoa
      A->>M: save_agent_memory({ ... })
      M-->>A: { ok: true }
    end
    A-->>M: AgentResponse { action: "..." }
    Note over M: Balidatu eta ekintza aplikatu`,
  },
};

export const INSTRUCTIONS_UI_COPY = { es, eu } as const;

export function getInstructionsCopy(locale?: string) {
  return INSTRUCTIONS_UI_COPY[locale === 'eu' ? 'eu' : 'es'];
}
