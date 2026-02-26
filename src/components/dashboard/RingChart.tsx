'use client';

interface RingChartProps {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * SVG ring (donut) chart.
 * Renders a circular progress arc with the value centered inside.
 */
export function RingChart({
  value,
  max = 100,
  label,
  unit = '%',
  size = 120,
  strokeWidth = 10,
}: RingChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, value / max));
  const dashOffset = circumference * (1 - pct);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="img"
      aria-label={`${label}: ${value}${unit}`}
    >
      <svg width={size} height={size} className="shrink-0">
        {/* Background track — start from top (rotate -90°) */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        {/* Center text */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={size * 0.18}
          fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {unit === '%' ? `${value}%` : `${value}${unit}`}
        </text>
      </svg>
      <span className="text-slate-400 text-xs text-center leading-tight max-w-[120px]">{label}</span>
    </div>
  );
}
