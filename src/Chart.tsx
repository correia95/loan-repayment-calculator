import type { PeriodRow } from './loan';

// Loan balance over time, with the cumulative split of principal vs interest.
export default function Chart({ rows, perYear }: { rows: PeriodRow[]; perYear: number }) {
  const W = 640;
  const H = 220;
  const pad = { l: 8, r: 8, t: 10, b: 20 };

  if (rows.length < 2) return null;
  const start = rows[0].balance + rows[0].principal;
  const maxY = start;
  const totalYears = rows.length / perYear;

  const x = (i: number) => pad.l + (i / (rows.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);

  const balancePath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r.balance).toFixed(1)}`).join(' ');
  const areaPath = `${balancePath} L${x(rows.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  const yearTicks = [];
  for (let yr = 0; yr <= totalYears; yr += totalYears > 20 ? 5 : totalYears > 8 ? 2 : 1) {
    const i = Math.min(rows.length - 1, Math.round(yr * perYear));
    yearTicks.push({ yr, i });
  }

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Loan balance over time">
      <path d={areaPath} className="c-area" />
      <path d={balancePath} className="c-line" fill="none" />
      {yearTicks.map((t) => (
        <g key={t.yr}>
          <line x1={x(t.i)} y1={pad.t} x2={x(t.i)} y2={H - pad.b} className="c-grid" />
          <text x={x(t.i)} y={H - 6} className="c-tick" textAnchor="middle">
            {t.yr === 0 ? 'now' : `${t.yr}y`}
          </text>
        </g>
      ))}
    </svg>
  );
}
