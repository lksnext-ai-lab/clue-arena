import {
  SOSPECHOSOS,
  ARMAS,
  HABITACIONES,
  PERSONAJE_META,
  ARMA_META,
  ESCENARIO_META,
} from '@/types/domain';
import { getLocale } from 'next-intl/server';
import { getInstructionsCopy } from './copy';

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={[
        'px-4 py-2.5 border-b border-slate-800',
        mono ? 'font-mono text-cyan-300' : 'text-slate-300',
      ].join(' ')}
    >
      {children}
    </td>
  );
}

export async function SuspectsTable() {
  const locale = await getLocale();
  const copy = getInstructionsCopy(locale).elements;

  return (
    <TableWrapper>
      <caption className="sr-only">{copy.suspectsCaption}</caption>
      <thead>
        <tr>
          <Th>{copy.idHeader}</Th>
          <Th>{copy.canonicalNameHeader}</Th>
          <Th>{copy.departmentHeader}</Th>
          <Th>{copy.colorHeader}</Th>
        </tr>
      </thead>
      <tbody>
        {SOSPECHOSOS.map((s, i) => {
          const meta = PERSONAJE_META[s];
          return (
            <tr key={s} className="hover:bg-slate-800/30">
              <Td mono>S-0{i + 1}</Td>
              <Td mono>{s}</Td>
              <Td>{copy.departments[s] ?? meta.departamento}</Td>
              <Td>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-slate-600"
                    style={{ backgroundColor: meta.color }}
                  />
                  <code className="text-xs text-slate-400">{meta.color}</code>
                </span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableWrapper>
  );
}

export async function WeaponsTable() {
  const locale = await getLocale();
  const copy = getInstructionsCopy(locale).elements;

  return (
    <TableWrapper>
      <caption className="sr-only">{copy.weaponsCaption}</caption>
      <thead>
        <tr>
          <Th>{copy.idHeader}</Th>
          <Th>{copy.canonicalNameHeader}</Th>
          <Th>{copy.emojiHeader}</Th>
        </tr>
      </thead>
      <tbody>
        {ARMAS.map((a, i) => {
          const meta = ARMA_META[a];
          return (
            <tr key={a} className="hover:bg-slate-800/30">
              <Td mono>A-0{i + 1}</Td>
              <Td mono>{a}</Td>
              <Td>{meta.emoji}</Td>
            </tr>
          );
        })}
      </tbody>
    </TableWrapper>
  );
}

export async function ScenariosTable() {
  const locale = await getLocale();
  const copy = getInstructionsCopy(locale).elements;

  return (
    <TableWrapper>
      <caption className="sr-only">{copy.scenariosCaption}</caption>
      <thead>
        <tr>
          <Th>{copy.idHeader}</Th>
          <Th>{copy.canonicalNameHeader}</Th>
          <Th>{copy.emojiHeader}</Th>
        </tr>
      </thead>
      <tbody>
        {HABITACIONES.map((h, i) => {
          const meta = ESCENARIO_META[h];
          const idStr = `E-${String(i + 1).padStart(2, '0')}`;
          return (
            <tr key={h} className="hover:bg-slate-800/30">
              <Td mono>{idStr}</Td>
              <Td mono>{h}</Td>
              <Td>{meta.emoji}</Td>
            </tr>
          );
        })}
      </tbody>
    </TableWrapper>
  );
}
