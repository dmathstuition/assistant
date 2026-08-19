// Reusable single-series bar chart (pure SVG, brand accent). Baseline-anchored,
// rounded tops, native hover titles. Values are formatted by the caller.
export type Bar = { label: string; value: number };

export default function BarChart({
  bars,
  color = "#d95926",
  format = (n: number) => String(Math.round(n)),
  height = 150,
}: {
  bars: Bar[];
  color?: string;
  format?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const any = bars.some((b) => b.value > 0);
  const groupW = Math.max(18, Math.min(56, Math.floor(560 / Math.max(bars.length, 1))));
  const barW = Math.round(groupW * 0.6);
  const W = bars.length * groupW;
  const y = (v: number) => height - (v / max) * height;

  if (!any) return <p className="text-sm text-brand-muted">No data for this range.</p>;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height + 24}`}
        className="h-44 w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Bar chart"
      >
        <line x1="0" y1={height} x2={W} y2={height} stroke="#1c3050" strokeWidth="1" />
        {bars.map((b, i) => {
          const cx = i * groupW + groupW / 2;
          const h = height - y(b.value);
          return (
            <g key={`${b.label}-${i}`}>
              <rect
                x={cx - barW / 2}
                y={y(b.value)}
                width={barW}
                height={h}
                rx="4"
                fill={color}
              >
                <title>
                  {b.label}: {format(b.value)}
                </title>
              </rect>
              <text
                x={cx}
                y={height + 16}
                textAnchor="middle"
                className="fill-brand-muted"
                style={{ fontSize: 9 }}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
