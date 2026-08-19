import { naira } from "@/components/Naira";
import { PieIcon } from "@/components/icons";

// Spending-by-category donut for the current month. Categorical identity job:
// fixed-order CVD-safe hues (validated for the dark card surface), capped at the
// top 6 categories with the rest folded into a neutral "Other" — hues are never
// cycled. A legend carries category + amount + %, so identity is never by color
// alone.
export type Slice = { category: string; amount: number };

// Fixed categorical order — do not cycle. Validated (dataviz skill) against the
// #0f1f38 card surface: CVD-safe, in-band lightness, ≥3:1 contrast.
const PALETTE = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
];
const OTHER = "#93a4c3"; // neutral — "Other" is a catch-all, not a real category

export default function SpendingDonut({ slices }: { slices: Slice[] }) {
  const sorted = [...slices]
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // Top 6 keep their hue; the remainder collapse into one grey "Other".
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const restTotal = rest.reduce((t, s) => t + s.amount, 0);
  const wedges = restTotal > 0 ? [...top, { category: "Other", amount: restTotal }] : top;
  const total = sorted.reduce((t, s) => t + s.amount, 0);

  const R = 70;
  const C = 2 * Math.PI * R;
  const GAP = total > 0 && wedges.length > 1 ? 2 : 0; // px gap between wedges

  let offset = 0;
  const arcs = wedges.map((w, i) => {
    const frac = w.amount / total;
    const len = Math.max(frac * C - GAP, 0);
    const arc = {
      color: i < 6 ? PALETTE[i] : OTHER,
      dash: `${len} ${C - len}`,
      // start each arc where the last ended (plus the gap we shaved off)
      offset: -offset,
      category: w.category,
      amount: w.amount,
      pct: Math.round(frac * 100),
    };
    offset += frac * C;
    return arc;
  });

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <PieIcon className="text-base text-brand-accent" />
        Spending by category · this month
      </div>

      {total === 0 ? (
        <p className="text-sm text-brand-muted">No spending yet this month.</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <svg
            viewBox="0 0 180 180"
            className="h-40 w-40 shrink-0"
            role="img"
            aria-label="Spending by category donut chart"
          >
            <g transform="rotate(-90 90 90)">
              {arcs.map((a) => (
                <circle
                  key={a.category}
                  cx="90"
                  cy="90"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="22"
                  strokeDasharray={a.dash}
                  strokeDashoffset={a.offset}
                >
                  <title>
                    {a.category}: {naira(a.amount)} ({a.pct}%)
                  </title>
                </circle>
              ))}
            </g>
            <text
              x="90"
              y="86"
              textAnchor="middle"
              className="fill-brand-muted"
              style={{ fontSize: 10 }}
            >
              Total
            </text>
            <text
              x="90"
              y="102"
              textAnchor="middle"
              fill="#e8eefc"
              style={{ fontSize: 15, fontWeight: 700 }}
            >
              {naira(total)}
            </text>
          </svg>

          <ul className="w-full space-y-1.5 text-sm">
            {arcs.map((a) => (
              <li key={a.category} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: a.color }}
                />
                <span className="truncate">{a.category}</span>
                <span className="ml-auto whitespace-nowrap text-brand-muted">
                  {naira(a.amount)} · {a.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
