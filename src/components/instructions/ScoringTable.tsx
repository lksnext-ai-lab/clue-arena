import { getLocale } from 'next-intl/server';
import { getInstructionsCopy } from './copy';

export async function ScoringTable() {
  const locale = await getLocale();
  const copy = getInstructionsCopy(locale).scoring;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <caption className="sr-only">{copy.caption}</caption>
        <thead>
          <tr>
            <th className="border-b border-slate-700 bg-slate-800/80 px-3 py-2.5 font-semibold text-slate-300 sm:px-4">
              {copy.eventHeader}
            </th>
            <th className="border-b border-slate-700 bg-slate-800/80 px-3 py-2.5 font-semibold text-slate-300 sm:px-4">
              {copy.whenHeader}
            </th>
            <th className="border-b border-slate-700 bg-slate-800/80 px-3 py-2.5 text-right font-semibold whitespace-nowrap text-slate-300 sm:px-4">
              {copy.pointsHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {copy.events.map((e) => (
            <tr key={e.id} className="hover:bg-slate-800/30">
              <td className="border-b border-slate-800 px-3 py-2.5 font-mono text-xs whitespace-nowrap text-cyan-300 sm:px-4">
                {e.id}
              </td>
              <td className="border-b border-slate-800 px-3 py-2.5 text-slate-300 sm:px-4">
                {e.description}
              </td>
              <td
                className={[
                  'border-b border-slate-800 px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap sm:px-4',
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
