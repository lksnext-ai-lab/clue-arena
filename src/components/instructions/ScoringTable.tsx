import { getLocale } from 'next-intl/server';
import { getInstructionsCopy } from './copy';

export async function ScoringTable() {
  const locale = await getLocale();
  const copy = getInstructionsCopy(locale).scoring;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">{copy.caption}</caption>
        <thead>
          <tr>
            <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">
              {copy.eventHeader}
            </th>
            <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700">
              {copy.whenHeader}
            </th>
            <th className="px-4 py-2.5 font-semibold text-slate-300 bg-slate-800/80 border-b border-slate-700 text-right whitespace-nowrap">
              {copy.pointsHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {copy.events.map((e) => (
            <tr key={e.id} className="hover:bg-slate-800/30">
              <td className="px-4 py-2.5 border-b border-slate-800 font-mono text-xs text-cyan-300 whitespace-nowrap">
                {e.id}
              </td>
              <td className="px-4 py-2.5 border-b border-slate-800 text-slate-300">
                {e.description}
              </td>
              <td
                className={[
                  'px-4 py-2.5 border-b border-slate-800 text-right font-mono font-bold whitespace-nowrap',
                  e.color,
                ].join(' ')}
              >
                {e.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
