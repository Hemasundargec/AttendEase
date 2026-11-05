import { useMemo, useState } from 'react'
import Seo from '../components/Seo.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import SemesterPicker from '../components/SemesterPicker.jsx'
import { useApi } from '../hooks.js'
import { fmtPercent } from '../lib/format.js'

export default function ShowAttendance() {
  const [semester, setSemester] = useState(null) // null = current semester
  const q = semester ? `semester=${semester}` : ''
  const summary = useApi(`/api/student/attendance/summary${q ? `?${q}` : ''}`, [semester])
  const history = useApi(`/api/student/attendance/history?limit=200${q ? `&${q}` : ''}`, [semester])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('name')

  const rows = useMemo(() => {
    const list = (summary.data?.subjects ?? []).filter((s) => `${s.code} ${s.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    const by = {
      name: (a, b) => a.name.localeCompare(b.name),
      low: (a, b) => (a.percentage ?? 101) - (b.percentage ?? 101),
      high: (a, b) => (b.percentage ?? -1) - (a.percentage ?? -1),
    }[sort]
    return [...list].sort(by)
  }, [summary.data, query, sort])

  const o = summary.data?.overall
  const byDate = useMemo(() => {
    const groups = new Map()
    for (const e of history.data?.entries ?? []) groups.set(e.date, [...(groups.get(e.date) ?? []), e])
    return [...groups]
  }, [history.data])

  return (
    <div className="container section">
      <Seo path="/attendance" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Show attendance</h1>
      <SemesterPicker value={semester} onChange={setSemester} />
      {summary.loading && <p role="status">Loading...</p>}
      {summary.error && <p className="status err" role="alert">{summary.error}</p>}

      {o && (
        <>
          <section className="card stack" aria-labelledby="agg-title">
            <h2 id="agg-title" style={{ fontSize: '1.2rem' }}>Overall aggregate</h2>
            <p className="big">{fmtPercent(o.percentage)}</p>
            <ProgressBar percent={o.percentage} label="Overall attendance" />
            <p>{o.attended} attended, {o.conducted} conducted, {o.missed} missed</p>
            <StatusBadge status={o.status} />
          </section>

          <section className="card" aria-labelledby="sub-title">
            <h2 id="sub-title" style={{ fontSize: '1.2rem' }}>Subject-wise</h2>
            {summary.data.subjects.length === 0 ? <p>No subjects are set up for your semester yet.</p> : (
              <>
                <div className="controls">
                  <div className="field"><label htmlFor="q">Search subjects</label>
                    <input id="q" type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Code or name" /></div>
                  <div className="field"><label htmlFor="sort">Sort by</label>
                    <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                      <option value="name">Subject name</option>
                      <option value="low">Lowest attendance first</option>
                      <option value="high">Highest attendance first</option>
                    </select></div>
                </div>
                <div className="table-wrap">
                  <table className="plain">
                    <thead><tr><th>Code</th><th>Subject</th><th>Conducted</th><th>Attended</th><th>Missed</th><th>%</th><th>Status</th></tr></thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.subjectId}>
                          <td>{s.code}</td><td>{s.name}</td><td>{s.conducted}</td><td>{s.attended}</td><td>{s.missed}</td>
                          <td>{s.percentage === null ? '-' : fmtPercent(s.percentage)}</td>
                          <td><StatusBadge status={s.status} />{s.belowSubjectMinimum && <div className="small st-danger"><strong>Below {summary.data.policy.subjectMinPercent}%</strong></div>}</td>
                        </tr>
                      ))}
                      {rows.length === 0 && <tr><td colSpan={7}>No subject matches your search.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="hist-title">
            <h2 id="hist-title" style={{ fontSize: '1.2rem' }}>History by date</h2>
            {history.loading && <p role="status">Loading...</p>}
            {history.error && <p className="status err" role="alert">{history.error}</p>}
            {history.data && byDate.length === 0 && <p>Nothing entered yet. Use Mark attendance to add your first day.</p>}
            {byDate.map(([date, items]) => (
              <details key={date} className="day">
                <summary>{date} <span className="muted">&middot; {items.reduce((n, e) => n + e.attended, 0)} / {items.reduce((n, e) => n + e.conducted, 0)}</span></summary>
                <ul>
                  {items.map((e) => <li key={e.code}>{e.name} ({e.code}): {e.attended} of {e.conducted}</li>)}
                </ul>
              </details>
            ))}
          </section>
          <Disclaimer />
        </>
      )}
    </div>
  )
}
