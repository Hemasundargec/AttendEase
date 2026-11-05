import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { todayIndia, shiftDate } from '../lib/format.js'

const MAX_BACK_DAYS = 180
const isCount = (v) => /^\d{1,2}$/.test(v) && Number(v) <= 20

export default function MarkAttendance() {
  const { user } = useAuth()
  const today = useMemo(todayIndia, [])
  const [date, setDate] = useState(today)
  const [day, setDay] = useState(null)       // server data for the chosen date
  const [rows, setRows] = useState({})       // subjectId -> { conducted, attended } as strings
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'err', text }
  const [mode, setMode] = useState('ticks')   // 'ticks' (timetable) or 'numbers'
  const [ticks, setTicks] = useState([])      // one { held, att } per timetable period of this weekday

  useEffect(() => {
    let cancelled = false
    setLoading(true); setNotice(null); setErrors({}); setLoadError('')
    api(`/api/student/attendance/day/${date}`).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) { setDay(null); setLoadError(res.data.message || 'Could not load this date.'); return }
      setDay(res.data)
      setRows(Object.fromEntries(res.data.subjects.map((s) => [s.id, { conducted: s.entered ? String(s.conducted) : '', attended: s.entered ? String(s.attended) : '' }])))
      // Rebuild the ticks from the saved counts: the first N periods of a subject were held, the first M of those attended.
      const periods = res.data.periods || []
      const seen = {}
      const built = periods.map((id) => {
        const sub = res.data.subjects.find((x) => x.id === id)
        const k = (seen[id] = (seen[id] || 0) + 1)
        return { held: Boolean(sub?.entered) && k <= sub.conducted, att: Boolean(sub?.entered) && k <= sub.attended }
      })
      setTicks(built)
      // Saved numbers that the timetable cannot represent (extra classes, other subjects) stay editable as numbers.
      const mismatch = res.data.subjects.some((x) => x.entered && x.conducted > 0 && x.conducted > periods.filter((id) => id === x.id).length)
      setMode(periods.length > 0 && !mismatch ? 'ticks' : 'numbers')
    })
    return () => { cancelled = true }
  }, [date])

  const set = (id, field) => (e) => setRows((r) => ({ ...r, [id]: { ...r[id], [field]: e.target.value.trim() } }))

  // Live total over rows that are valid right now (display only; the server recalculates everything).
  const totals = useMemo(() => {
    let attended = 0, conducted = 0
    for (const r of Object.values(rows)) {
      if (isCount(r.conducted) && isCount(r.attended) && Number(r.attended) <= Number(r.conducted)) { attended += Number(r.attended); conducted += Number(r.conducted) }
    }
    return { attended, conducted }
  }, [rows])

  const periods = day?.periods || []
  const tickTotals = useMemo(() => ({ conducted: ticks.filter((t) => t.held).length, attended: ticks.filter((t) => t.held && t.att).length }), [ticks])
  const shown = mode === 'ticks' ? tickTotals : totals
  const setTick = (i, patch) => { setTicks((t) => t.map((x, k) => (k === i ? { ...x, ...patch } : x))); setNotice(null) }
  const tickAll = (held, att) => { setTicks((t) => t.map(() => ({ held, att }))); setNotice(null) }

  const saveTicks = async () => {
    setNotice(null)
    const per = new Map()
    periods.forEach((id, i) => {
      const e = per.get(id) || { subjectId: id, conducted: 0, attended: 0 }
      if (ticks[i]?.held) { e.conducted += 1; if (ticks[i].att) e.attended += 1 }
      per.set(id, e)
    })
    setBusy(true)
    const res = await api(`/api/student/attendance/day/${date}`, { method: 'PUT', body: { entries: [...per.values()] } })
    setBusy(false)
    if (res.ok) { setNotice({ kind: 'ok', text: `Saved ${date}: attended ${tickTotals.attended} of ${tickTotals.conducted} classes.` }); return }
    setNotice({ kind: 'err', text: res.data.message || 'Could not save. Please try again.' })
  }

  // Fills every subject with 0 and 0. Saving that records "no classes were held", which also stops reminders.
  const noClasses = () => {
    setRows(Object.fromEntries(day.subjects.map((s) => [s.id, { conducted: '0', attended: '0' }])))
    setErrors({}); setNotice(null)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setNotice(null)
    const found = {}, entries = []
    for (const s of day.subjects) {
      const r = rows[s.id]
      if (r.conducted === '' && r.attended === '') continue // left blank: stays "not entered"
      if (!isCount(r.conducted)) found[s.id] = 'Classes conducted must be a whole number from 0 to 20.'
      else if (!isCount(r.attended)) found[s.id] = 'Classes attended must be a whole number from 0 to 20.'
      else if (Number(r.attended) > Number(r.conducted)) found[s.id] = 'Attended cannot be more than conducted.'
      else entries.push({ subjectId: s.id, conducted: Number(r.conducted), attended: Number(r.attended) })
    }
    setErrors(found)
    if (Object.keys(found).length) { setNotice({ kind: 'err', text: 'Please fix the highlighted subjects.' }); return }
    if (entries.length === 0) { setNotice({ kind: 'err', text: 'Enter at least one subject before saving.' }); return }
    setBusy(true)
    const res = await api(`/api/student/attendance/day/${date}`, { method: 'PUT', body: { entries } })
    setBusy(false)
    if (res.ok) { setNotice({ kind: 'ok', text: `Saved ${entries.length} subject${entries.length === 1 ? '' : 's'} for ${date}.` }); return }
    if (res.data.rowErrors) setErrors(res.data.rowErrors)
    setNotice({ kind: 'err', text: res.data.message || 'Could not save. Please try again.' })
  }

  return (
    <div className="container section">
      <Seo path="/attendance/mark" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Mark attendance</h1>

      <section className="card stack" aria-label="Day details">
        <p><strong>{user.name}</strong> &middot; {user.rollNumber}</p>
        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} min={shiftDate(today, -MAX_BACK_DAYS)} max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        {day && <p>{day.weekday}</p>}
        <p className="daily-total" aria-live="polite">Daily total: <strong>{shown.attended} / {shown.conducted}</strong></p>
      </section>

      {loading && <p role="status">Loading subjects...</p>}
      {loadError && <p className="status err" role="alert">{loadError}</p>}

      {day && day.subjects.length === 0 && (
        <p className="card">You have no subjects yet. <Link to="/timetable">Add your subjects and timetable</Link> first, then come back to tick your classes.</p>
      )}

      {day && day.subjects.length > 0 && (
        <p className="row">
          {periods.length > 0 && <button type="button" className="btn btn-quiet small-btn" style={{ color: 'var(--platinum)', borderColor: 'var(--platinum)' }} onClick={() => setMode(mode === 'ticks' ? 'numbers' : 'ticks')}>{mode === 'ticks' ? 'Enter numbers instead' : 'Use my timetable ticks'}</button>}
          <Link to="/timetable" className="small">Edit subjects and timetable</Link>
        </p>
      )}

      {day && day.subjects.length > 0 && mode === 'ticks' && (
        <section aria-label={`Classes on ${day.weekday}`}>
          <p className="small">For each class on your {day.weekday} timetable, tick <strong>Class happened</strong>, and tick <strong>I attended</strong> if you were there. Untick Class happened if it was cancelled or a holiday.</p>
          <ol className="subject-list">
            {periods.map((id, i) => {
              const sub = day.subjects.find((x) => x.id === id)
              const t = ticks[i] || { held: false, att: false }
              return (
                <li key={`${id}-${i}`} className="card tick-row">
                  <div><strong>{sub?.name}</strong><div className="small muted">Period {i + 1}</div></div>
                  <label className="tick"><input type="checkbox" checked={t.held} onChange={(e) => setTick(i, { held: e.target.checked, att: e.target.checked ? t.att : false })} />
                    <span>Class happened</span></label>
                  <label className="tick"><input type="checkbox" checked={t.att} disabled={!t.held} onChange={(e) => setTick(i, { att: e.target.checked })} />
                    <span>I attended</span></label>
                </li>
              )
            })}
          </ol>
          <p className="row">
            <button type="button" className="btn btn-quiet small-btn" style={{ color: 'var(--platinum)', borderColor: 'var(--platinum)' }} onClick={() => tickAll(true, true)}>Tick all (attended everything)</button>
            <button type="button" className="btn btn-quiet small-btn" style={{ color: 'var(--platinum)', borderColor: 'var(--platinum)' }} onClick={() => tickAll(false, false)}>Clear all (no classes today)</button>
          </p>
          {notice && <p className={`status ${notice.kind === 'ok' ? 'ok' : 'err'}`} role={notice.kind === 'ok' ? 'status' : 'alert'}>{notice.text}</p>}
          <button className="btn btn-primary" type="button" onClick={saveTicks} disabled={busy}>{busy ? 'Saving...' : 'Save attendance'}</button>
        </section>
      )}

      {day && day.subjects.length > 0 && periods.length === 0 && (
        <p className="card small">You have no timetable set for {day.weekday}. Enter numbers below, or <Link to="/timetable">set your timetable</Link> to tick classes instead.</p>
      )}

      {day && day.subjects.length > 0 && mode === 'numbers' && (
        <form onSubmit={onSubmit} noValidate>
          <ul className="subject-list">
            {day.subjects.map((s) => {
              const err = errors[s.id]
              return (
                <li key={s.id} className="card subject-row">
                  <div>
                    <strong>{s.name}</strong>
                    <div className="small muted">{s.code} &middot; {s.entered ? 'Saved' : 'Not entered yet'}</div>
                  </div>
                  <div className="pair">
                    <div className="field">
                      <label htmlFor={`c-${s.id}`}>Conducted</label>
                      <input id={`c-${s.id}`} type="number" inputMode="numeric" min="0" max="20" step="1" value={rows[s.id]?.conducted ?? ''} onChange={set(s.id, 'conducted')}
                        aria-invalid={Boolean(err)} aria-describedby={err ? `e-${s.id}` : undefined} />
                    </div>
                    <div className="field">
                      <label htmlFor={`a-${s.id}`}>Attended</label>
                      <input id={`a-${s.id}`} type="number" inputMode="numeric" min="0" max="20" step="1" value={rows[s.id]?.attended ?? ''} onChange={set(s.id, 'attended')}
                        aria-invalid={Boolean(err)} aria-describedby={err ? `e-${s.id}` : undefined} />
                    </div>
                  </div>
                  {err && <p className="error" id={`e-${s.id}`} style={{ gridColumn: '1 / -1' }}>{err}</p>}
                </li>
              )
            })}
          </ul>
          <p className="small">Leave both boxes empty for a subject you are not entering. Enter 0 and 0 if no class was held.</p>
          <p><button type="button" className="btn btn-quiet small-btn" onClick={noClasses} style={{ color: 'var(--platinum)', borderColor: 'var(--platinum)' }}>No classes on this day</button></p>
          {notice && <p className={`status ${notice.kind === 'ok' ? 'ok' : 'err'}`} role={notice.kind === 'ok' ? 'status' : 'alert'}>{notice.text}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save attendance'}</button>
        </form>
      )}
      <Disclaimer />
    </div>
  )
}
