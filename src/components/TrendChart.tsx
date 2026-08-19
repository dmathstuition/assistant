import { naira } from "@/components/Naira";
import { TrendingUpIcon } from "@/components/icons";

// Income vs expenses over the last months. Two entities → two fixed hues
// (income green, expenses orange), a legend plus month labels, one shared y
// axis (never dual-axis). Grouped bars, baseline-anchored with rounded ends and
// a 2px gap between the pair.
export type MonthPoint = { label: string; income: number; expense: number };

const INCOME = "#199e70";
const EXPENSE = "#d95926";

export default function TrendChart({ months }: { months: MonthPoint[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const anyData = months.some((m) => m.income > 0 || m.expense > 0);

  // Geometry
  const H = 150; // plot height
  const groupW = 44;
  const barW = 16;
  const W = months.length * groupW;

  const y = (v: number) => H - (v / max) * H;

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <TrendingUpIcon className="text-base text-brand-accent" />
        Income vs expenses · last {months.length} months
      </div>

      <div className="mb-3 flex gap-4 text-xs text-brand-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE }} />
          Expenses
        </span>
      </div>

      {!anyData ? (
        <p className="text-sm text-brand-muted">No data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H + 22}`}
            className="h-44 w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Income versus expenses grouped bar chart"
          >
            {/* baseline */}
            <line x1="0" y1={H} x2={W} y2={H} stroke="#1c3050" strokeWidth="1" />
            {months.map((m, i) => {
              const cx = i * groupW + groupW / 2;
              return (
                <g key={m.label}>
                  <rect
                    x={cx - barW - 1}
                    y={y(m.income)}
                    width={barW}
                    height={H - y(m.income)}
                    rx="4"
                    fill={INCOME}
                  >
                    <title>
                      {m.label} income: {naira(m.income)}
                    </title>
                  </rect>
                  <rect
                    x={cx + 1}
                    y={y(m.expense)}
                    width={barW}
                    height={H - y(m.expense)}
                    rx="4"
                    fill={EXPENSE}
                  >
                    <title>
                      {m.label} expenses: {naira(m.expense)}
                    </title>
                  </rect>
                  <text
                    x={cx}
                    y={H + 15}
                    textAnchor="middle"
                    className="fill-brand-muted"
                    style={{ fontSize: 10 }}
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
