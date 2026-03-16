import type { ReactNode } from 'react';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  DatabaseZap,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { InstructionsLayout } from '@/components/instructions/InstructionsLayout';
import { SectionWrapper } from '@/components/instructions/SectionWrapper';
import { CodeBlock } from '@/components/instructions/CodeBlock';
import { SuspectsTable, WeaponsTable, ScenariosTable } from '@/components/instructions/ElementsTable';
import { MermaidDiagram } from '@/components/instructions/MermaidDiagram';
import { ScoringTable } from '@/components/instructions/ScoringTable';
import { getLocale, getTranslations } from 'next-intl/server';
import { getInstructionsCopy } from '@/components/instructions/copy';

const GAME_STATE_INPUT = `{
  "game_id": "string",
  "team_id": "string"
}`;

const GAME_STATE_OUTPUT = `{
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
      "cartas": ["Directora Scarlett", "El Laboratorio", "Teclado mecánico", "Dra. Peacock"]
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
      "arma": "Teclado mecánico",
      "escenario": "El Laboratorio",
      "refutadoPor": "string | null",
      "cartaMostrada": "Coronel Mustard | null",
      "nadiePudoRefutar": false
    }
  ]
}`;

const MEMORY_INPUT = `{
  "game_id": "string",
  "team_id": "string"
}`;

const MEMORY_OUTPUT = `{
  "memory": { }
}`;

const SAVE_MEMORY_INPUT = `{
  "game_id": "string",
  "team_id": "string",
  "memory": {
    "cartasDescartadas": ["Directora Scarlett", "El Laboratorio"],
    "hipotesisSobre": { "sospechoso": "Coronel Mustard", "confianza": 0.8 }
  }
}`;

const SAVE_MEMORY_OUTPUT = `{ "ok": true }`;

export default async function InstruccionesPage() {
  const locale = await getLocale();
  const t = await getTranslations('instrucciones');
  const tJuego = await getTranslations('juego');
  const copy = getInstructionsCopy(locale).page;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
  const mcpToken = process.env.MCP_AUTH_TOKEN?.trim() || '';
  const maskedMcpToken = maskSecret(mcpToken);
  const mattinMcpConfig = `{
  "clue-arena": {
    "url": "${appBaseUrl}/api/mcp",
    "transport": "http",
    "headers": {
      "X-API-KEY": "${maskedMcpToken}"
    }
  }
}`;

  return (
    <InstructionsLayout>
      <section
        id="intro"
        className="scroll-mt-20 overflow-hidden rounded-[32px] border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_35%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(145deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.92))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55)] md:p-10"
      >
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white md:text-5xl">
                {tJuego('subtitulo')}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                {t('heroBannerDesc')}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {copy.heroMetrics.map((metric, index) => (
                <HeroMetric
                  key={`${metric.label}-${index}`}
                  icon={
                    index === 0 ? <Bot className="h-4 w-4" /> :
                    index === 1 ? <DatabaseZap className="h-4 w-4" /> :
                    <ShieldCheck className="h-4 w-4" />
                  }
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone as 'cyan' | 'emerald' | 'amber'}
                />
              ))}
            </div>

            <div className="grid gap-4">
              <HighlightPanel
                title={copy.essentialsTitle}
                description={copy.essentialsDescription}
                icon={<Sparkles className="h-4 w-4" />}
              >
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  {copy.launchChecklist.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 rounded-2xl border border-white/8 bg-white/5 px-3 py-3"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </HighlightPanel>

              <aside className="rounded-[28px] border border-white/10 bg-slate-950/50 p-5 backdrop-blur">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <ClipboardCheck className="h-4 w-4 text-amber-300" />
                  {copy.recommendedPathTitle}
                </div>
                <div className="space-y-3">
                  {copy.quickstartSteps.map((step, index) => (
                    <div key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/15 text-xs text-amber-200">
                          {index + 1}
                        </span>
                        {step.title}
                      </div>
                      <p className="text-sm leading-6 text-slate-400">{step.body}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[28px] border border-cyan-400/15 bg-slate-950/70 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <BrainCircuit className="h-4 w-4" />
                {copy.mentalModelTitle}
              </div>
              <div className="space-y-3">
                {copy.flowSteps.map((step) => (
                  <FlowStep
                    key={step.title}
                    title={step.title}
                    description={step.description}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-amber-400/15 bg-[linear-gradient(180deg,_rgba(120,53,15,0.28),_rgba(15,23,42,0.72))] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Trophy className="h-4 w-4" />
                {copy.arenaRewardsTitle}
              </div>
              <p className="text-sm leading-6 text-slate-300">
                {copy.arenaRewardsDescription}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {copy.rewardNotes.map((note) => (
                  <MiniNote key={note.label} label={note.label} value={note.value} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionWrapper id="quickstart" title={t('sec8Titulo')} titleNumber="1">
        <div className="grid gap-4 lg:grid-cols-2">
          {copy.quickstartSteps.map((step, index) => (
            <StepCard key={step.title} index={index + 1} title={step.title}>
              <p className="text-sm leading-6 text-slate-400">{step.body}</p>
            </StepCard>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <HighlightPanel
            title={copy.mcpConfigTitle}
            description={copy.mcpConfigDescription}
            icon={<KeyRound className="h-4 w-4" />}
          >
            <CodeBlock code={mattinMcpConfig} language="json" filename="mcp-config.json" />
            <p className="text-xs leading-5 text-slate-500">
              {copy.mcpConfigTokenNotePrefix}
              <code className="mx-1 font-mono text-slate-300">MCP_AUTH_TOKEN</code>.
            </p>
          </HighlightPanel>

          <HighlightPanel
            title={copy.clueArenaDataTitle}
            description={copy.clueArenaDataDescription}
            icon={<ClipboardCheck className="h-4 w-4" />}
          >
            <div className="space-y-3">
              {copy.keyValueItems.map((item) => (
                <KeyValueItem key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </HighlightPanel>
        </div>

        <HighlightPanel
          title={copy.systemPromptTitle}
          description={copy.systemPromptDescription}
          icon={<Bot className="h-4 w-4" />}
        >
          <CodeBlock code={copy.systemPrompt} language="text" filename="system-prompt.txt" />
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {copy.systemPromptWarningPrefix}{' '}
            <code className="font-mono text-amber-200">sospechoso</code>,{' '}
            <code className="font-mono text-amber-200">arma</code>,{' '}
            <code className="font-mono text-amber-200">escenario</code> y{' '}
            <code className="font-mono text-amber-200">carta</code> {copy.systemPromptWarningSuffix}
          </div>
        </HighlightPanel>
      </SectionWrapper>

      <SectionWrapper id="como-funciona" title={t('sec2Titulo')} titleNumber="2">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <HighlightPanel
            title={copy.invokeAgentTitle}
            description={copy.invokeAgentDescription}
            icon={<Swords className="h-4 w-4" />}
          >
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {copy.invokeHeaders.map((header) => (
                      <th
                        key={header}
                        className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {copy.invokeRows.map(([situation, mode, result]) => (
                    <tr key={`${mode}-${situation}`} className="hover:bg-slate-800/30">
                      <td className="border-b border-slate-800 px-4 py-3 text-slate-300">{situation}</td>
                      <td className="border-b border-slate-800 px-4 py-3 font-mono text-cyan-300">{mode}</td>
                      <td className="border-b border-slate-800 px-4 py-3 text-slate-300">{result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HighlightPanel>

          <HighlightPanel
            title={copy.turnSequenceTitle}
            description={copy.turnSequenceDescription}
            icon={<ChevronRight className="h-4 w-4" />}
          >
            <MermaidDiagram chart={copy.sequenceDiagram} />
          </HighlightPanel>
        </div>

        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-4 text-sm text-slate-300">
          <strong className="text-cyan-200">{copy.importantNoteLabel}</strong> {copy.importantNotePrefix}{' '}
          <code className="font-mono text-cyan-200">AgentResponse</code> {copy.importantNoteSuffix}
        </div>
      </SectionWrapper>

      <SectionWrapper id="herramientas" title={t('sec4Titulo')} titleNumber="4">
        <div className="grid gap-4 md:grid-cols-3">
          {copy.toolSummaries.map((tool) => (
            <ToolSummary key={tool.name} name={tool.name} summary={tool.summary} />
          ))}
        </div>

        <ToolPanel
          name="get_game_state"
          description={copy.toolStateDescription}
          footer={copy.toolStateFooter}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.inputLabel}</p>
              <CodeBlock code={GAME_STATE_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.outputLabel}</p>
              <CodeBlock code={GAME_STATE_OUTPUT} language="json" />
            </div>
          </div>
        </ToolPanel>

        <ToolPanel
          name="get_agent_memory"
          description={copy.toolMemoryDescription}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.inputLabel}</p>
              <CodeBlock code={MEMORY_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.outputLabel}</p>
              <CodeBlock code={MEMORY_OUTPUT} language="json" />
            </div>
          </div>
        </ToolPanel>

        <ToolPanel
          name="save_agent_memory"
          description={copy.toolSaveDescription}
          footer={copy.toolSaveFooter}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.inputLabel}</p>
              <CodeBlock code={SAVE_MEMORY_INPUT} language="json" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{copy.outputLabel}</p>
              <CodeBlock code={SAVE_MEMORY_OUTPUT} language="json" />
            </div>
          </div>
        </ToolPanel>
      </SectionWrapper>

      <SectionWrapper id="respuesta" title={t('sec5Titulo')} titleNumber="5">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <HighlightPanel
            title={copy.agentResponseTitle}
            description={copy.agentResponseDescription}
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <CodeBlock code={copy.agentResponseSchema} language="typescript" />
          </HighlightPanel>

          <HighlightPanel
            title={copy.validActionsTitle}
            description={copy.validActionsDescription}
            icon={<ClipboardCheck className="h-4 w-4" />}
          >
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {copy.validActionsHeaders.map((header) => (
                      <th
                        key={header}
                        className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-800/30">
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-cyan-300">play_turn</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-emerald-300">suggestion · accusation · pass</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-rose-300">show_card · cannot_refute</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-cyan-300">refute</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-emerald-300">show_card · cannot_refute</td>
                    <td className="border-b border-slate-800 px-4 py-3 font-mono text-rose-300">suggestion · accusation · pass</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </HighlightPanel>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ExampleCard title={copy.exampleTitles[0]} code={copy.exampleSuggestion} />
          <ExampleCard title={copy.exampleTitles[1]} code={copy.exampleAccusation} />
          <ExampleCard title={copy.exampleTitles[2]} code={copy.examplePass} />
          <ExampleCard title={copy.exampleTitles[3]} code={copy.exampleShowCard} />
          <ExampleCard title={copy.exampleTitles[4]} code={copy.exampleCannotRefute} />
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          {copy.showCardNotePrefix} <code className="font-mono text-amber-200">show_card</code>, {copy.showCardNoteSuffix}
        </div>
      </SectionWrapper>

      <SectionWrapper id="elementos" title={t('sec6Titulo')} titleNumber="6">
        <HighlightPanel
          title={copy.canonicalValuesTitle}
          description={copy.canonicalValuesDescription}
          icon={<Sparkles className="h-4 w-4" />}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {copy.canonicalNotes.map((note) => (
              <MiniNote key={note.label} label={note.label} value={note.value} />
            ))}
          </div>
        </HighlightPanel>

        <h3 className="mt-2 text-lg font-semibold text-slate-200">{copy.canonicalHeadings[0]}</h3>
        <SuspectsTable />

        <h3 className="mt-2 text-lg font-semibold text-slate-200">{copy.canonicalHeadings[1]}</h3>
        <WeaponsTable />

        <h3 className="mt-2 text-lg font-semibold text-slate-200">{copy.canonicalHeadings[2]}</h3>
        <ScenariosTable />
      </SectionWrapper>

      <SectionWrapper id="puntuacion" title={t('sec7Titulo')} titleNumber="7">
        <ScoringTable />

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <HighlightPanel
            title={copy.speedBonusTitle}
            description={copy.speedBonusDescription}
            icon={<Trophy className="h-4 w-4" />}
          >
            <CodeBlock language="text" code={copy.speedBonusFormula} />
          </HighlightPanel>

          <HighlightPanel
            title={copy.designImplicationsTitle}
            description={copy.designImplicationsDescription}
            icon={<BrainCircuit className="h-4 w-4" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.designChecklist.map((item) => (
                <ChecklistItem key={item} text={item} />
              ))}
            </div>
          </HighlightPanel>
        </div>
      </SectionWrapper>

      <SectionWrapper id="registro" title={t('sec9Titulo')} titleNumber="9">
        <div className="grid gap-4 lg:grid-cols-2">
          {copy.registrationSteps.map((step, index) => (
            <StepCard key={step.title} index={index + 1} title={step.title}>
              <p className="text-sm leading-6 text-slate-400">{step.body}</p>
            </StepCard>
          ))}
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
          {copy.localhostWarningPrefix} <code className="font-mono text-rose-200">localhost</code> {copy.localhostWarningSuffix}
        </div>
      </SectionWrapper>

      <SectionWrapper id="faq" title={t('sec10Titulo')} titleNumber="10">
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{copy.faqCaption}</caption>
            <thead>
              <tr>
                {copy.faqHeaders.map((header) => (
                  <th
                    key={header}
                    className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 font-semibold text-slate-300"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copy.faqRows.map((row) => (
                <tr key={row.error} className="hover:bg-slate-800/30">
                  <td className="border-b border-slate-800 px-4 py-3 align-top text-amber-300">{row.error}</td>
                  <td className="border-b border-slate-800 px-4 py-3 align-top text-slate-400">{row.cause}</td>
                  <td className="border-b border-slate-800 px-4 py-3 align-top text-slate-300">{row.solution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
          {copy.faqFooter}
        </div>
      </SectionWrapper>
    </InstructionsLayout>
  );
}

function maskSecret(secret: string) {
  if (!secret) return '<MCP_AUTH_TOKEN>';
  if (secret.length <= 4) return '****';
  return `${secret.slice(0, 2)}${'•'.repeat(Math.max(secret.length - 4, 4))}${secret.slice(-2)}`;
}

function HeroMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'cyan' | 'emerald' | 'amber';
}) {
  const toneClasses = {
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function HighlightPanel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-950/55 p-5 backdrop-blur">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function StepCard({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-800 bg-slate-950/55 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-200">
          {index}
        </span>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FlowStep({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 px-4 py-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <ChevronRight className="h-4 w-4 text-cyan-300" />
        {title}
      </div>
      <p className="text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function MiniNote({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function KeyValueItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function ToolSummary({ name, summary }: { name: string; summary: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4">
      <p className="font-mono text-sm font-bold text-cyan-300">{name}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{summary}</p>
    </div>
  );
}

function ToolPanel({
  name,
  description,
  footer,
  children,
}: {
  name: string;
  description: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-950/55 p-5">
      <div className="mb-4">
        <h3 className="font-mono text-base font-bold text-cyan-300">{name}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {children}
      {footer ? <p className="mt-4 text-xs leading-5 text-slate-500">{footer}</p> : null}
    </div>
  );
}

function ExampleCard({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-[24px] border border-slate-800 bg-slate-950/55 p-4">
      <p className="mb-2 text-sm font-semibold text-slate-200">{title}</p>
      <CodeBlock code={code} language="json" />
    </div>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      <span className="text-sm leading-6 text-slate-300">{text}</span>
    </div>
  );
}
