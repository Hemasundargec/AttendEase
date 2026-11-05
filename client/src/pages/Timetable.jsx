import { useEffect, useState } from 'react'
import Seo from '../components/Seo.jsx'
import Field, { describedBy } from '../components/Field.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { api } from '../lib/api.js'

const DAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [7, 'Sunday']]
const emptyDays = () => Object.fromEntries(DAYS.map(([n]) => [String(n), []]))

export default function Timetable() {
  const [data, setData] = useState(null)         // { semester, subjects }
  const [days, setDays] = useState(emptyDays())  // editable copy
  const [dirty, setDirty] = useState(false)
  const [pick, setPick] = useState({})           // day -> subject chosen in that day's dropdown
  const [form, setForm] = useState({ name: '', code: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toRemove, setToRemove] = useState(null)
  const [loadError, setLoadError] = useState('')

  const load = async (keepEdits = false) => {
    const res = await api('/api/student/timetable')
    if (!res.ok) { setLoadError(res.data.message || 'Could not load your timetable.'); return }
    setLoadError('')
    setData({ semester: res.data.semester, subjects: res.data.subjects })
    if (!keepEdits) { setDays({ ...emptyDays(), ...res.data.days }); setDirty(false) }
    return res.data
  }
  useEffect(() => { load() }, [])

  const nameOf = (id) => data?.subjects.find((s) => s.id === id)?.name ?? 'Removed subject'

  const addSubject = async (e) => {
    e.preventDefault(); setNotice(null); setErrors({})
    setBusy(true)
    const res = await api('/api/student/my-subjects', { method: 'POST', body: { name: form.name, code: form.code } })
    setBusy(false)
    if (res.ok) { setForm({ name: '', code: '' }); setNotice({ kind: 'ok', text: `Added ${res.data.subject.name}. Now put it in your timetable below.` }); await load(true); return }
    setErrors(res.data.fieldErrors || {}); setNotice({ kind: 'err', text: res.data.message || 'Could not add the subject.' })
  }

  const confirmRemove = async () => {
    setBusy(true)
    const res = await api(`/api/student/my-subjects/${toRemove.id}`, { method: 'DELETE' })
    setBusy(false)
    const name = toRemove.name
    setToRemove(null)
    if (res.ok) { setNotice({ kind: 'ok', text: `Removed ${name}. Attendance you already saved for it is kept.` }); await load() } else setNotice({ kind: 'err', text: res.data.message || 'Could not remove it.' })
  }

  const addPeriod = (d) => {
    const id = pick[d]
    if (!id) return
    setDays((x) => ({ ...x, [d]: [...x[d], id] })); setDirty(true); setNotice(null)
  }
  const removePeriod = (d, i) => { setDays((x) => ({ ...x, [d]: x[d].filter((_, k) => k !== i) })); setDirty(true); setNotice(null) }
  const move = (d, i, by) => setDays((x) => {
    const list = [...x[d]]; const j = i + by
    if (j < 0 || j >= list.length) return x
    ;[list[i], list[j]] = [list[j], list[i]]
    setDirty(true); return { ...x, [d]: list }
  })

  const save = async () => {
    setBusy(true); setNotice(null)
    const res = await api('/api/student/timetable', { method: 'PUT', body: { days } })
    setBusy(false)
    if (res.ok) { setDirty(false); setNotice({ kind: 'ok', text: 'Timetable saved. Open "Mark" to tick your classes for any day.' }); return }
    setNotice({ kind: 'err', text: res.data.message || 'Could not save the timetable.' })
  }

  return (
    <div className="container section">
      <Seo path="/timetable" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>My subjects and timetable</h1>
      {data && <p>Semester {data.semester}. Add your subjects, then set which ones you have on each day. Each period is one class.</p>}
      {loadError && <p className="status err" role="alert">{loadError}</p>}
      {notice && <p className={`status ${notice.kind === 'ok' ? 'ok' : 'err'}`} role={notice.kind === 'ok' ? 'status' : 'alert'}>{notice.text}</p>}

      <section className="card stack" aria-labelledby="add-h">
        <h2 id="add-h" style={{ fontSize: '1.3rem' }}>Add a subject</h2>
        <form onSubmit={addSubject} noValidate className="stack">
          <Field id="ms-name" label="Subject name" error={errors.name}>
            <input id="ms-name" type="text" value={form.name} maxLength={100} placeholder="e.g. Data Structures" autoComplete="off"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy('ms-name', errors.name)} />
          </Field>
          <Field id="ms-code" label="Short code (optional)" error={errors.code} hint="Leave empty and we will make one for you.">
            <input id="ms-code" type="text" value={form.code} maxLength={20} autoComplete="off"
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} aria-invalid={Boolean(errors.code)} aria-describedby={describedBy('ms-code', errors.code, true)} />
          </Field>
          <div><button className="btn btn-primary" type="submit" disabled={busy}>Add subject</button></div>
        </form>

        {data && data.subjects.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.1rem' }}>Your subjects</h3>
            <ul className="plain-list" aria-label="Your subjects">
              {data.subjects.map((s) => (
                <li key={s.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span><strong>{s.name}</strong> <span className="small muted">{s.code}</span></span>
                  {s.mine
                    ? <button type="button" className="btn btn-quiet small-btn" onClick={() => setToRemove(s)} aria-label={`Remove ${s.name}`}>Remove</button>
                    : <span className="small muted">Set by admin</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {data && data.subjects.length === 0 && <p className="card">Add at least one subject above, then build your timetable.</p>}

      {data && data.subjects.length > 0 && (
        <section aria-labelledby="tt-h" className="stack">
          <h2 id="tt-h" style={{ fontSize: '1.3rem' }}>Weekly timetable</h2>
          <div className="tt-grid">
            {DAYS.map(([n, label]) => {
              const d = String(n)
              return (
                <div key={d} className="card tt-day">
                  <h3 style={{ fontSize: '1.1rem' }}>{label}</h3>
                  {days[d].length === 0 && <p className="small muted">No classes</p>}
                  <ol className="plain-list">
                    {days[d].map((id, i) => (
                      <li key={`${id}-${i}`} className="row" style={{ justifyContent: 'space-between' }}>
                        <span>{i + 1}. {nameOf(id)}</span>
                        <span className="row" style={{ gap: 6 }}>
                          <button type="button" className="btn btn-quiet small-btn" onClick={() => move(d, i, -1)} disabled={i === 0} aria-label={`Move period ${i + 1} up on ${label}`}>Up</button>
                          <button type="button" className="btn btn-quiet small-btn" onClick={() => removePeriod(d, i)} aria-label={`Remove period ${i + 1} from ${label}`}>X</button>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="row">
                    <label className="sr-only" htmlFor={`pick-${d}`}>Subject to add on {label}</label>
                    <select id={`pick-${d}`} value={pick[d] || ''} onChange={(e) => setPick((p) => ({ ...p, [d]: e.target.value }))}>
                      <option value="">Choose subject</option>
                      {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" className="btn btn-quiet small-btn" onClick={() => addPeriod(d)} disabled={!pick[d] || days[d].length >= 10}>Add period</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving...' : 'Save timetable'}</button>
            {dirty && <span className="small">You have unsaved changes.</span>}
          </div>
        </section>
      )}

      <ConfirmDialog open={Boolean(toRemove)} title="Remove this subject?" confirmLabel="Remove subject" busy={busy} onConfirm={confirmRemove} onCancel={() => setToRemove(null)}>
        <p>{toRemove?.name} will disappear from your timetable and the Mark page. Attendance you already saved for it stays in your history.</p>
      </ConfirmDialog>
    </div>
  )
}
