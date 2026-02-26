'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface StageData {
  etapa: string;
  puntos: number;
}

interface StageBarChartProps {
  data: StageData[];
}

const BAR_COLOR = '#22d3ee'; // cyan-400

export function StageBarChart({ data }: StageBarChartProps) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Puntos por Etapa</span>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="etapa"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#f1f5f9', fontSize: 12 }}
            itemStyle={{ color: '#22d3ee', fontSize: 12 }}
            cursor={{ fill: '#334155', opacity: 0.5 }}
          />
          <Bar dataKey="puntos" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
