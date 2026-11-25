import { useState } from 'react'
import Seo from '../components/Seo.jsx'
import { useApi } from '../hooks.js'

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LABEL = { P: 'Present', Pt: 'Partly present', A: 'Absent', H: 'Holiday or no class' }

export default function AttendanceSheet() {
  const [year, setYear] = useState(null)
  const { loading, error, data } = useApi(`/api/student/attendance/sheet${year ? `?year=${year}` : ''}`, [year])
  const [busy, setBusy] = useState(false)
  const [dlError, setDlError] = useState('')

  const download = async () => {
    setBusy(true); setDlError('')
    try {
      const res = await fetch(`/api/student/attendance/sheet.xlsx?year=${data.year}`, { credentials: 'same-origin' })
      if (!res.ok) {
        let msg = 'Could not make the Excel file. Please try again.'
        try { msg = (await res.json()).message || msg } catch { /* keep default */ }
        setDlError(msg); return
      }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `AttendEase-attendance-${data.year}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setDlError('Could not reach the server. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  const t = data?.totals
  const tiles = t && [['Total present', t.present, 'P'], ['Total partial', t.partial, 'Pt'], ['Total absent', t.absent, 'A'], ['Total holiday', t.holiday, 'H']]

  return (
    <div className="container section">
      <Seo path="/attendance/sheet" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Attendance sheet</h1>
      <p>Every day of the year at a glance. Each day is worked out from the classes you entered that day.</p>

      <div className="row" style={{ margin: '12px 0' }}>
        {data && (
          <>
            <label htmlFor="sheet-year" className="small">Year</label>
            <select id="sheet-year" className="sheet-select" value={data.year} onChange={(e) => setYear(e.target.value)}>
              {data.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        )}
        <button type="button" className="btn btn-primary" onClick={download} disabled={!data || busy}>{busy ? 'Preparing Excel...' : 'Download Excel'}</button>
      </div>
      {dlError && <p className="status err" role="alert">{dlError}</p>}
      {loading && <p role="status">Loading...</p>}
      {error && <p className="status err" role="alert">{error}</p>}

      {data && (
        <>
          <div className="sheet-tiles">
            {tiles.map(([label, n, code]) => (
              <div key={code} className="card sheet-tile">
                <div className="small">{label}</div>
                <div className={`sheet-num m-${code}`}>{n}</div>
              </div>
            ))}
          </div>
          <p className="small" style={{ margin: '4px 0 12px' }}>
            Classes attended in {data.year}: <strong>{t.classesAttended}</strong> of <strong>{t.classesConducted}</strong> conducted.
          </p>

          <p className="card sheet-legend" aria-label="Legend">
            <span><b className="m-P">P</b> Present (attended all)</span>
            <span><b className="m-Pt">Pt</b> Partly present</span>
            <span><b className="m-A">A</b> Absent</span>
            <span><b className="m-H">H</b> Holiday / no class (Sundays included)</span>
            <span><b>blank</b> Not entered</span>
          </p>

          <div className="card table-wrap sheet-wrap">
            <table className="sheet-table">
              <caption className="sr-only">Attendance for {data.year}: one row per day of the month, one column per month</caption>
              <thead>
                <tr><th scope="col">Date | Month</th>{SHORT.map((m, i) => <th scope="col" key={m} title={data.months[i]}>{m}</th>)}</tr>
              </thead>
              <tbody>
                {data.rows.map((row, d) => (
                  <tr key={d}>
                    <th scope="row">{d + 1}</th>
                    {row.map((mark, m) => (
                      mark === null
                        ? <td key={m} className="sheet-na" aria-label="No such date">-</td>
                        : <td key={m} className={mark ? `m-${mark}` : ''} aria-label={mark ? `${d + 1} ${data.months[m]}: ${LABEL[mark]}` : `${d + 1} ${data.months[m]}: not entered`}>{mark}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small" style={{ marginTop: 12 }}>The Excel file has this same sheet, plus a subject-wise tab.</p>
        </>
      )}
    </div>
  )
}
