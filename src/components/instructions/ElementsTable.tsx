import {
  SOSPECHOSOS,
  ARMAS,
  HABITACIONES,
  PERSONAJE_META,
  ARMA_META,
  ESCENARIO_META,
} from '@/types/domain';

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

export function SuspectsTable() {
  return (
    <TableWrapper>
      <caption className="sr-only">Sospechosos canónicos del evento</caption>
      <thead>
        <tr>
          <Th>ID</Th>
          <Th>Nombre canónico</Th>
          <Th>Departamento</Th>
          <Th>Color</Th>
        </tr>
      </thead>
      <tbody>
        {SOSPECHOSOS.map((s, i) => {
          const meta = PERSONAJE_META[s];
          return (
            <tr key={s} className="hover:bg-slate-800/30">
              <Td mono>S-0{i + 1}</Td>
              <Td mono>{s}</Td>
              <Td>{meta.departamento}</Td>
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

export function WeaponsTable() {
  return (
    <TableWrapper>
      <caption className="sr-only">Armas canónicas del evento</caption>
      <thead>
        <tr>
          <Th>ID</Th>
          <Th>Nombre canónico</Th>
          <Th>Emoji</Th>
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

export function ScenariosTable() {
  return (
    <TableWrapper>
      <caption className="sr-only">Escenarios canónicos del evento</caption>
      <thead>
        <tr>
          <Th>ID</Th>
          <Th>Nombre canónico</Th>
          <Th>Emoji</Th>
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
