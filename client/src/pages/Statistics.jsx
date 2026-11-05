import { useState } from 'react'
import Seo from '../components/Seo.jsx'
import SemesterPicker from '../components/SemesterPicker.jsx'
import TrendChart from '../components/TrendChart.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import { useApi } from '../hooks.js'
import { fmtPercent } from '../lib/format.js'

const monthName = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function Statistics() {
  const [semester, setSemester] = useState(null)
  const q = semester ? `?semester=${semester}` : ''
  const { loading, error, data } = useApi(`/api/student/attendance/stats${q}`, [semester])
  const policy = useApi(`/api/student/attendance/summary${q}`, [semester]).data?.policy
  const o = data?.overall

  return (
    <div className="container section">
      <Seo path="/statistics" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Attendance statistics</h1>
      <SemesterPicker value={semester} onChange={setSemester} />
      {loading && <p role="status">Loading...</p>}
      {error && <p className="status err" role="alert">{error}</p>}

      {data && o.conducted === 0 && <p className="card" style={{ marginTop: 18 }}>No classes have been entered for this semester yet, so there are no statistics to show.</p>}

      {data && o.conducted > 0 && (
        <>
          <section className="card stack" aria-labelledby="ov-title" style={{ marginTop: 18 }}>
            <h2 id="ov-title" style={{ fontSize: '1.2rem' }}>Totals</h2>
            <p className="big">{fmtPercent(o.percentage)}</p>
            <StatusBadge status={o.status} />
            <dl className="details">
              <div><dt>Classes conducted</dt><dd>{o.conducted}</dd></div>
              <div><dt>Classes attended</dt><dd>{o.attended}</dd></div>
              <div><dt>Classes missed</dt><dd>{o.missed}</dd></div>
              <div><dt>Days recorded</dt><dd>{data.daysRecorded}</dd></div>
              {data.highest && <div><dt>Highest subject</dt><dd>{data.highest.name} ({fmtPercent(data.highest.percentage)})</dd></div>}
              {data.lowest && <div><dt>Lowest subject</dt><dd>{data.lowest.name} ({fmtPercent(data.lowest.percentage)})</dd></div>}
            </dl>
          </section>

          <section className="card" aria-labelledby="trend-title">
            <h2 id="trend-title" style={{ fontSize: '1.2rem' }}>Trend over time</h2>
            <p className="small muted">Cumulative attendance after each day you recorded. Days with no entry are not drawn.</p>
            <TrendChart points={data.trend} safePercent={policy?.safePercent ?? 75} />
          </section>

          <section className="card" aria-labelledby="cmp-title">
            <h2 id="cmp-title" style={{ fontSize: '1.2rem' }}>Subject comparison</h2>
            <ul className="bars">
              {data.subjects.map((s) => (
                <li key={s.subjectId}>
                  <div className="bar-head"><span>{s.name} <span className="muted">({s.code})</span></span><strong>{s.percentage === null ? '-' : fmtPercent(s.percentage)}</strong></div>
                  <ProgressBar percent={s.percentage} label={`${s.name} attendance`} />
                  <div className="small muted">{s.attended} of {s.conducted}{s.belowSubjectMinimum ? ' - below the subject minimum' : ''}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="mon-title">
            <h2 id="mon-title" style={{ fontSize: '1.2rem' }}>Month by month</h2>
            <div className="table-wrap">
              <table className="plain">
                <thead><tr><th>Month</th><th>Days</th><th>Attended</th><th>Conducted</th><th>%</th></tr></thead>
                <tbody>{data.monthly.map((m) => <tr key={m.month}><td>{monthName(m.month)}</td><td>{m.days}</td><td>{m.attended}</td><td>{m.conducted}</td><td>{m.percentage === null ? '-' : fmtPercent(m.percentage)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <Disclaimer />
        </>
      )}
    </div>
  )
}
