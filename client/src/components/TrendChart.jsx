import { fmtPercent } from '../lib/format.js'

// Cumulative attendance after each recorded day. Only days that really have entries are plotted,
// evenly spaced, so gaps are never filled in with made-up points. A table version sits below for
// screen readers and for anyone who prefers numbers.
export default function TrendChart({ points, safePercent }) {
  const W = 420, H = 250, L = 50, R = 14, T = 16, B = 44 // narrow viewBox so text stays readable when scaled onto a phone
  const plotted = points.filter((p) => p.percentage !== null)
  if (plotted.length === 0) return <p>There are no classes recorded yet, so there is no trend to draw.</p>
  const x = (i) => (plotted.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (plotted.length - 1))
  const y = (v) => T + ((100 - v) * (H - T - B)) / 100
  const path = plotted.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.percentage).toFixed(1)}`).join(' ')
  const first = plotted[0], last = plotted[plotted.length - 1]
  const label = `Line chart of cumulative attendance over ${plotted.length} recorded day${plotted.length === 1 ? '' : 's'}, from ${fmtPercent(first.percentage)} on ${first.date} to ${fmtPercent(last.percentage)} on ${last.date}.`
  const tickIdx = plotted.length > 2 ? [0, plotted.length - 1] : [...new Set([0, plotted.length - 1])] // end dates only: more would collide on a phone
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#3e2b1d" strokeOpacity="0.15" />
            <text x={L - 8} y={y(g) + 5} textAnchor="end" fontSize="15" fill="#3e2b1d">{g}%</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(safePercent)} y2={y(safePercent)} stroke="#3e2b1d" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={W - R} y={y(safePercent) - 6} textAnchor="end" fontSize="15" fontWeight="700" fill="#3e2b1d">{safePercent}% line</text>
        <path d={path} fill="none" stroke="#6f4e37" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {plotted.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.percentage)} r="4.5" fill="#6f4e37" stroke="#e5e4e2" strokeWidth="2" />)}
        {tickIdx.map((i) => <text key={i} x={x(i)} y={H - 14} textAnchor={i === 0 && plotted.length > 1 ? 'start' : i === plotted.length - 1 && plotted.length > 1 ? 'end' : 'middle'} fontSize="15" fill="#3e2b1d">{plotted[i].date}</text>)}
      </svg>
      <details className="day">
        <summary>View the numbers as a table</summary>
        <div className="table-wrap">
          <table className="plain">
            <thead><tr><th>Date</th><th>That day</th><th>Total so far</th><th>%</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.date}><td>{p.date}</td><td>{p.dayAttended} / {p.dayConducted}</td><td>{p.attended} / {p.conducted}</td><td>{p.percentage === null ? '-' : fmtPercent(p.percentage)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
