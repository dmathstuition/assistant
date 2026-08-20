// A 0–100 score ring (pure SVG). Colour bands: red → orange → accent → green.
export default function ScoreRing({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const R = 60;
  const C = 2 * Math.PI * R;
  const dash = (s / 100) * C;
  const color =
    s >= 75 ? "#199e70" : s >= 50 ? "#d95926" : s >= 25 ? "#f59e0b" : "#ef4444";

  return (
    <svg viewBox="0 0 150 150" className="h-36 w-36" role="img" aria-label={`Health score ${s}`}>
      <g transform="rotate(-90 75 75)">
        <circle cx="75" cy="75" r={R} fill="none" stroke="#1c3050" strokeWidth="12" />
        <circle
          cx="75"
          cy="75"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
        />
      </g>
      <text x="75" y="72" textAnchor="middle" fill="#e8eefc" style={{ fontSize: 30, fontWeight: 700 }}>
        {s}
      </text>
      <text x="75" y="92" textAnchor="middle" className="fill-brand-muted" style={{ fontSize: 11 }}>
        {label}
      </text>
    </svg>
  );
}
